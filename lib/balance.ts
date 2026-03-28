import {
  getMonthlyIncomes, getMonthlyBillPayments, getCardTransactions,
  getFixedBills, getIncomeSources, getBalanceOverrides,
} from "./queries";
import { computeInstallment, getAccConfig } from "./utils";
import type { AccumuladoConfig } from "./utils";
import type { FixedBill, IncomeSource, MonthlyBalanceOverride } from "@/types";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface MonthBalanceData {
  month: number;
  year: number;
  totalIncome: number;
  totalBills: number;
  totalCards: number;
  balance: number;
  /** Categorias de contas com seus totais */
  billsByCategory: Record<string, number>;
  /** Total de cartões por card_id */
  cardTotals: Record<string, number>;
}

export interface MonthAccumulated extends MonthBalanceData {
  saldoAcumulado: number | null;
  hasOverride: boolean;
  overrideNotes: string | null;
}

// ─── Cache simples em memória (por sessão de página) ─────────────────────────

const cache = new Map<string, MonthBalanceData>();

function cacheKey(month: number, year: number): string {
  return `${year}-${month}`;
}

export function clearBalanceCache() {
  cache.clear();
}

// ─── Cálculo de um mês ──────────────────────────────────────────────────────

export async function computeMonthBalance(
  month: number,
  year: number,
  /** Passa dados pré-carregados para evitar queries repetidas */
  preloaded?: {
    allBills?: FixedBill[];
    allSources?: IncomeSource[];
  },
): Promise<MonthBalanceData> {
  const key = cacheKey(month, year);
  const cached = cache.get(key);
  if (cached) return cached;

  const [incomes, billPayments, txs, allBills, allSources] = await Promise.all([
    getMonthlyIncomes(month, year),
    getMonthlyBillPayments(month, year),
    getCardTransactions(month, year),
    preloaded?.allBills ? Promise.resolve(preloaded.allBills) : getFixedBills(),
    preloaded?.allSources ? Promise.resolve(preloaded.allSources) : getIncomeSources(),
  ]);

  // Receita
  const sourcesForMonth = allSources.filter(s =>
    s.is_recurring !== false ||
    (s.one_time_month === month && s.one_time_year === year)
  );
  const totalIncome = sourcesForMonth.reduce((s, src) => {
    const mi = incomes.find(i => i.source_id === src.id);
    return s + (mi?.amount ?? src.base_amount);
  }, 0);

  // Contas fixas
  const titheBill = allBills.find(b => b.is_tithe);
  const regularBills = allBills.filter(b => !b.is_tithe);
  const visibleBills = regularBills.filter(bill => {
    if (!bill.installment_total) return true;
    if (bill.installment_start_month == null || bill.installment_start_year == null) return true;
    return computeInstallment(bill, month, year) !== null;
  });

  const billIds = billPayments.map(b => b.bill_id);
  const missingBills = visibleBills.filter(b => !billIds.includes(b.id));

  const billsByCategory: Record<string, number> = {};
  const addBillCat = (amount: number, category: string) => {
    billsByCategory[category] = (billsByCategory[category] ?? 0) + amount;
  };

  billPayments
    .filter(b => visibleBills.some(vb => vb.id === b.bill_id))
    .forEach(b => {
      const bill = visibleBills.find(vb => vb.id === b.bill_id);
      addBillCat(b.amount ?? bill?.amount ?? 0, bill?.category ?? "outros");
    });
  missingBills.forEach(b => addBillCat(b.amount, b.category));

  // Dízimo
  const tithePayment = titheBill ? billPayments.find(b => b.bill_id === titheBill.id) : null;
  const titheAmt = tithePayment?.amount ?? (titheBill ? totalIncome * 0.1 : 0);
  if (titheBill) {
    addBillCat(titheAmt, titheBill.category ?? "essencial");
  }

  const totalBills = Object.values(billsByCategory).reduce((s, v) => s + v, 0);

  // Cartões
  const cardTotals: Record<string, number> = {};
  txs.forEach(t => {
    cardTotals[t.card_id] = (cardTotals[t.card_id] ?? 0) - t.amount;
  });
  const totalCards = txs.reduce((s, t) => s - t.amount, 0);

  const result: MonthBalanceData = {
    month, year,
    totalIncome, totalBills, totalCards,
    balance: totalIncome - totalBills - totalCards,
    billsByCategory, cardTotals,
  };

  cache.set(key, result);
  return result;
}

// ─── Saldo acumulado de um ano inteiro ───────────────────────────────────────

export async function computeYearBalances(
  year: number,
  accConfig?: AccumuladoConfig,
): Promise<MonthAccumulated[]> {
  const cfg = accConfig ?? getAccConfig();

  const [allBills, allSources, overrides] = await Promise.all([
    getFixedBills(),
    getIncomeSources(),
    getBalanceOverrides(year),
  ]);

  const overrideMap = new Map<number, MonthlyBalanceOverride>();
  overrides.forEach(o => overrideMap.set(o.month, o));

  // Calcula saldo inicial do ano (carry-over de anos anteriores)
  let yearStartBalance = cfg.saldoInicial;
  if (year > cfg.startYear) {
    // Acumula todos os meses do startYear.startMonth até dez do ano anterior
    for (let y = cfg.startYear; y < year; y++) {
      const startM = y === cfg.startYear ? cfg.startMonth : 1;
      const prevOverrides = y !== year ? await getBalanceOverrides(y) : [];
      const prevOverrideMap = new Map<number, MonthlyBalanceOverride>();
      prevOverrides.forEach(o => prevOverrideMap.set(o.month, o));

      for (let m = startM; m <= 12; m++) {
        const md = await computeMonthBalance(m, y, { allBills, allSources });
        yearStartBalance += md.balance;

        const ov = prevOverrideMap.get(m);
        if (ov) {
          yearStartBalance = ov.auto_zero ? 0 : ov.override_amount;
        }
      }
    }
  }

  // Calcula cada mês do ano
  const monthsData = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      computeMonthBalance(i + 1, year, { allBills, allSources })
    )
  );

  let running = yearStartBalance;
  return monthsData.map((md, i) => {
    const m = i + 1;
    const override = overrideMap.get(m);

    // Antes do período de acumulação
    if (cfg.startYear === year && m < cfg.startMonth) {
      return { ...md, saldoAcumulado: null, hasOverride: false, overrideNotes: null };
    }

    running += md.balance;

    // Aplica override
    if (override) {
      running = override.auto_zero ? 0 : override.override_amount;
    }

    return {
      ...md,
      saldoAcumulado: running,
      hasOverride: !!override,
      overrideNotes: override?.notes ?? null,
    };
  });
}

// ─── Saldo acumulado até um mês específico (para usar como "saldo anterior") ─

export async function computePrevBalance(
  month: number,
  year: number,
  accConfig?: AccumuladoConfig,
): Promise<number> {
  const cfg = accConfig ?? getAccConfig();

  // Se o mês é anterior ou igual ao início da acumulação, retorna saldo inicial
  if (year < cfg.startYear || (year === cfg.startYear && month <= cfg.startMonth)) {
    return cfg.saldoInicial;
  }

  const yearData = await computeYearBalances(year, cfg);

  // O saldo anterior é o acumulado do mês anterior
  if (month === 1) {
    // Precisa do acumulado de dezembro do ano anterior
    const prevYear = await computeYearBalances(year - 1, cfg);
    return prevYear[11]?.saldoAcumulado ?? cfg.saldoInicial;
  }

  return yearData[month - 2]?.saldoAcumulado ?? cfg.saldoInicial;
}
