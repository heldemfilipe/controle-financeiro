import {
  getMonthlyIncomesByYear, getMonthlyBillPaymentsByYear, getCardTransactionsByYear,
  getFixedBills, getIncomeSources, getBalanceOverrides,
  getBillAdvancesMadeInYear, getBillAdvancesForYear,
  getIncomeSourceAmounts,
} from "./queries";
import { isBillActiveInMonth, resolveSourceAmount, isSourceActiveInMonth, isTitheBill } from "./utils";
import { loadAccConfig } from "./settings";
import type { AccumuladoConfig } from "./utils";
import { TITHE_RATE } from "./gastos-mensais/tithe";
import type {
  BillAdvance, CardTransaction, FixedBill, IncomeSource, IncomeSourceAmount,
  MonthlyBalanceOverride, MonthlyBillPayment, MonthlyIncome,
} from "@/types";

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

// ─── Dados por ano ───────────────────────────────────────────────────────────
// Cada ano é buscado de uma vez, em vez de vários acessos por mês. O cache guarda a
// promessa, então cargas simultâneas do mesmo ano reaproveitam a mesma busca.

interface SharedData {
  allBills: FixedBill[];
  allSources: IncomeSource[];
  allSourceAmounts: IncomeSourceAmount[];
}

interface MonthRecords {
  incomes: MonthlyIncome[];
  billPayments: MonthlyBillPayment[];
  txs: CardTransaction[];
  advancesMade: BillAdvance[];
  advancesFor: BillAdvance[];
}

let sharedCache: Promise<SharedData> | null = null;
const yearCache = new Map<number, Promise<MonthBalanceData[]>>();

export function clearBalanceCache() {
  sharedCache = null;
  yearCache.clear();
}

function loadSharedData(): Promise<SharedData> {
  sharedCache ??= Promise.all([getFixedBills(), getIncomeSources(), getIncomeSourceAmounts()])
    .then(([allBills, allSources, allSourceAmounts]) => ({ allBills, allSources, allSourceAmounts }));
  sharedCache.catch(() => { sharedCache = null; });
  return sharedCache;
}

function loadYearMonths(year: number): Promise<MonthBalanceData[]> {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const months = Promise.all([
    loadSharedData(),
    getMonthlyIncomesByYear(year),
    getMonthlyBillPaymentsByYear(year),
    getCardTransactionsByYear(year),
    getBillAdvancesMadeInYear(year),
    getBillAdvancesForYear(year),
  ]).then(([shared, incomes, billPayments, txs, advancesMade, advancesFor]) =>
    Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return calcMonthBalance(month, year, shared, {
        incomes: incomes.filter(r => r.month === month),
        billPayments: billPayments.filter(r => r.month === month),
        txs: txs.filter(r => r.month === month),
        advancesMade: advancesMade.filter(a => a.paid_month === month),
        advancesFor: advancesFor.filter(a => a.target_month === month),
      });
    }),
  );

  yearCache.set(year, months);
  months.catch(() => yearCache.delete(year));
  return months;
}

// ─── Cálculo de um mês ──────────────────────────────────────────────────────

export async function computeMonthBalance(month: number, year: number): Promise<MonthBalanceData> {
  return (await loadYearMonths(year))[month - 1];
}

function calcMonthBalance(
  month: number,
  year: number,
  { allBills, allSources, allSourceAmounts }: SharedData,
  { incomes, billPayments, txs, advancesMade, advancesFor }: MonthRecords,
): MonthBalanceData {
  const advancedBillIds = new Set(advancesFor.map(a => a.bill_id));

  // Receita
  const sourcesForMonth = allSources.filter(s => isSourceActiveInMonth(s, month, year));
  const totalIncome = sourcesForMonth.reduce((s, src) => {
    const mi = incomes.find(i => i.source_id === src.id);
    return s + (mi?.amount ?? resolveSourceAmount(src, month, year, allSourceAmounts));
  }, 0);

  // Contas fixas
  const titheBill = allBills.find(b => isTitheBill(b) && isBillActiveInMonth(b, month, year));
  const regularBills = allBills.filter(b => !isTitheBill(b));
  const visibleBills = regularBills.filter(bill => isBillActiveInMonth(bill, month, year));

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
      const effectiveAmount = advancedBillIds.has(b.bill_id) ? 0 : (b.amount ?? bill?.amount ?? 0);
      addBillCat(effectiveAmount, bill?.category ?? "outros");
    });
  missingBills.forEach(b => {
    const effectiveAmount = advancedBillIds.has(b.id) ? 0 : b.amount;
    addBillCat(effectiveAmount, b.category);
  });

  // Adiantamentos feitos neste mês (pagamentos antecipados de contas futuras)
  advancesMade.forEach(a => {
    const bill = allBills.find(b => b.id === a.bill_id);
    addBillCat(a.amount, bill?.category ?? "outros");
  });

  // Dízimo
  const tithePayment = titheBill ? billPayments.find(b => b.bill_id === titheBill.id) : null;
  const titheAmt = tithePayment?.amount ?? (titheBill ? totalIncome * TITHE_RATE : 0);
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

  return {
    month, year,
    totalIncome, totalBills, totalCards,
    balance: totalIncome - totalBills - totalCards,
    billsByCategory, cardTotals,
  };
}

// ─── Saldo acumulado de um ano inteiro ───────────────────────────────────────

export async function computeYearBalances(
  year: number,
  accConfig?: AccumuladoConfig,
): Promise<MonthAccumulated[]> {
  const cfg = accConfig ?? await loadAccConfig();

  const previousYears = Array.from(
    { length: Math.max(0, year - cfg.startYear) },
    (_, i) => cfg.startYear + i,
  );

  const [overrides, monthsData, previous] = await Promise.all([
    getBalanceOverrides(year),
    loadYearMonths(year),
    Promise.all(previousYears.map(y => Promise.all([loadYearMonths(y), getBalanceOverrides(y)]))),
  ]);

  const overrideMap = new Map<number, MonthlyBalanceOverride>();
  overrides.forEach(o => overrideMap.set(o.month, o));

  // Saldo inicial do ano: acumula do mês de início até dezembro do ano anterior
  let yearStartBalance = cfg.saldoInicial;
  previous.forEach(([months, yearOverrides], index) => {
    const startMonth = index === 0 ? cfg.startMonth : 1;
    months.slice(startMonth - 1).forEach(md => {
      yearStartBalance += md.balance;
      const ov = yearOverrides.find(o => o.month === md.month);
      if (ov) yearStartBalance = ov.auto_zero ? 0 : ov.override_amount;
    });
  });

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
  const cfg = accConfig ?? await loadAccConfig();

  // Se o mês é anterior ou igual ao início da acumulação, retorna saldo inicial
  if (year < cfg.startYear || (year === cfg.startYear && month <= cfg.startMonth)) {
    return cfg.saldoInicial;
  }

  // O saldo anterior é o acumulado do mês anterior; em janeiro, dezembro do ano anterior
  const yearData = await computeYearBalances(month === 1 ? year - 1 : year, cfg);
  return yearData[month === 1 ? 11 : month - 2]?.saldoAcumulado ?? cfg.saldoInicial;
}
