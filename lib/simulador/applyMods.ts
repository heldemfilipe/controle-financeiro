import { computeInstallment } from "@/lib/utils";
import { calculateAmortization } from "@/lib/loan";
import type { FixedBill, MonthlyBalanceOverride } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ModType =
  | "remove_bill"          // Remover conta fixa (para sempre)
  | "pay_off_installment"  // Quitar parcelamento/financiamento de uma vez
  | "add_expense"          // Nova despesa mensal
  | "income_change"        // Alterar renda (+/-)
  | "one_time_income"      // Receita avulsa
  | "one_time_expense"     // Despesa avulsa
  | "loan";                // Novo empréstimo / Financiamento

export interface ScenarioMod {
  id: string;
  type: ModType;
  billId: string;
  amount: number;
  startMonth: number;
  endMonth: number;
  // Campos de empréstimo
  loanRate?: number;
  loanInstallments?: number;
  loanMethod?: "price" | "sac";
  /** Ano em que o empréstimo foi contraído (fixo — não muda ao navegar entre anos) */
  loanStartYear?: number;
  // Quitação customizada (pay_off_installment)
  payoffAmount?: number;     // valor customizado; se null usa cálculo automático
}

export interface MonthData {
  month: number;
  name: string;
  receitas: number;
  billsTotal: number;
  cartoes: number;
  despesas: number;
  saldo: number;
  saldoAcumulado: number;
}

export interface AccCfg { startMonth: number; startYear: number; saldoInicial: number }

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function newMod(): ScenarioMod {
  return {
    id: crypto.randomUUID(),
    type: "remove_bill",
    billId: "",
    amount: 0,
    startMonth: new Date().getMonth() + 1,
    endMonth: 12,
  };
}

/** Verifica se uma conta tem alguma parcela ativa no ano informado */
export function isBillActiveInYear(bill: FixedBill, year: number): boolean {
  if (!bill.installment_total || bill.installment_start_month == null || bill.installment_start_year == null) {
    return true; // conta fixa sem parcelas = sempre ativa
  }
  // Verifica se ao menos um mês do ano tem parcela ativa
  for (let m = 1; m <= 12; m++) {
    if (computeInstallment(bill, m, year) !== null) return true;
  }
  return false;
}

export function remainingInstallments(bill: FixedBill, fromMonth: number, year: number): number {
  if (!bill.installment_total || bill.installment_start_month == null || bill.installment_start_year == null) return 0;
  const startAbs   = bill.installment_start_year * 12 + bill.installment_start_month - 1;
  const fromAbs    = year * 12 + fromMonth - 1;
  const elapsed    = fromAbs - startAbs; // parcelas já pagas antes do mês de quitação
  return Math.max(0, bill.installment_total - elapsed);
}

/** Verifica se um mod está suficientemente preenchido para ser aplicado */
export function isModValid(mod: ScenarioMod): boolean {
  if (mod.type === "remove_bill") return !!mod.billId;
  if (mod.type === "pay_off_installment") return !!mod.billId;
  if (mod.type === "loan") return mod.amount > 0 && (mod.loanInstallments ?? 0) > 0 && (mod.loanRate ?? 0) >= 0;
  return mod.amount !== 0;
}

export function applyMods(
  base: MonthData[],
  mods: ScenarioMod[],
  bills: FixedBill[],
  year: number,
  startBalance: number = 0,
  cfg?: AccCfg,
  overrides: MonthlyBalanceOverride[] = [],
): MonthData[] {
  // Overrides de saldo (zerar / ajustar acumulado) — mesmos aplicados no cenário atual
  const overrideMap = new Map<number, MonthlyBalanceOverride>();
  overrides.forEach(o => overrideMap.set(o.month, o));
  // Pré-computa amortizações de empréstimos (evita recalcular 12x por loan)
  const loanPayments = new Map<string, Map<number, number>>(); // modId → month → payment
  for (const mod of mods) {
    if (mod.type === "loan" && mod.amount > 0 && (mod.loanInstallments ?? 0) > 0 && mod.loanRate != null) {
      // O empréstimo é sempre calculado a partir do ano em que foi contraído
      // (loanStartYear), não do ano atualmente exibido — assim as parcelas
      // que caem em anos seguintes aparecem corretamente ao navegar entre anos.
      const rows = calculateAmortization({
        amount: mod.amount,
        monthlyRate: mod.loanRate / 100,
        installments: mod.loanInstallments!,
        method: mod.loanMethod ?? "price",
        startMonth: mod.startMonth,
        startYear: mod.loanStartYear ?? year,
      });
      const byMonth = new Map<number, number>();
      for (const r of rows) {
        if (r.year === year) byMonth.set(r.month, r.payment);
      }
      loanPayments.set(mod.id, byMonth);
    }
  }

  const modified = base.map(row => {
    let receitas   = row.receitas;
    let billsTotal = row.billsTotal;

    for (const mod of mods) {
      if (!isModValid(mod)) continue; // ignora mods incompletos

      switch (mod.type) {
        case "remove_bill": {
          if (row.month < mod.startMonth || row.month > mod.endMonth) break;
          const bill = bills.find(b => b.id === mod.billId);
          if (!bill) break;
          if (bill.installment_total && bill.installment_start_month != null && bill.installment_start_year != null) {
            if (computeInstallment(bill, row.month, year) === null) break;
          }
          billsTotal = Math.max(0, billsTotal - bill.amount);
          break;
        }
        case "pay_off_installment": {
          const bill = bills.find(b => b.id === mod.billId);
          if (!bill) break;
          if (row.month === mod.startMonth) {
            const remaining = remainingInstallments(bill, mod.startMonth, year);
            const cost = mod.payoffAmount != null && mod.payoffAmount > 0
              ? mod.payoffAmount
              : remaining * bill.amount;
            billsTotal += cost;
            // Remove a parcela normal do mês de quitação (para não dobrar)
            billsTotal = Math.max(0, billsTotal - bill.amount);
          } else if (row.month > mod.startMonth) {
            // Meses após a quitação: remove a parcela (já foi pago)
            const isInstallment = bill.installment_total != null &&
              bill.installment_start_month != null &&
              bill.installment_start_year != null;
            if (isInstallment) {
              if (computeInstallment(bill, row.month, year) !== null) {
                billsTotal = Math.max(0, billsTotal - bill.amount);
              }
            } else {
              billsTotal = Math.max(0, billsTotal - bill.amount);
            }
          }
          break;
        }
        case "add_expense":      if (row.month >= mod.startMonth && row.month <= mod.endMonth) billsTotal += mod.amount; break;
        case "income_change":    if (row.month >= mod.startMonth && row.month <= mod.endMonth) receitas   += mod.amount; break;
        case "one_time_income":  if (row.month === mod.startMonth) receitas   += mod.amount; break;
        case "one_time_expense": if (row.month === mod.startMonth) billsTotal += mod.amount; break;
        case "loan": {
          // Recebimento do valor emprestado só ocorre no ano em que o empréstimo foi contraído
          if (row.month === mod.startMonth && (mod.loanStartYear ?? year) === year) receitas += mod.amount;
          const payment = loanPayments.get(mod.id)?.get(row.month);
          if (payment) billsTotal += payment;
          break;
        }
      }
    }

    const despesas = billsTotal + row.cartoes;
    return { ...row, receitas, billsTotal, despesas, saldo: receitas - despesas };
  });

  let acc = startBalance;
  return modified.map(m => {
    if (cfg && year === cfg.startYear && m.month < cfg.startMonth) {
      return { ...m, saldoAcumulado: 0 };
    }
    acc += m.saldo;
    // Aplica o mesmo override de saldo do cenário atual (zerar / ajustar acumulado),
    // para que meses zerados sejam transmitidos igualmente à simulação.
    const ov = overrideMap.get(m.month);
    if (ov) acc = ov.auto_zero ? 0 : ov.override_amount;
    return { ...m, saldoAcumulado: acc };
  });
}
