import { MONTHS } from "@/types";
import type { FixedBill } from "@/types";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: string | null): string {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export function getMonthName(month: number): string {
  return MONTHS[month - 1] || "";
}

export function getCurrentMonth(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getDueDayLabel(day: number): string {
  return `Dia ${day.toString().padStart(2, "0")}`;
}

export function isOverdue(dueDay: number, month: number, year: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  if (year < currentYear) return true;
  if (year === currentYear && month < currentMonth) return true;
  if (year === currentYear && month === currentMonth && dueDay < currentDay) return true;
  return false;
}

/**
 * Retorna true se o vencimento é hoje ou nos próximos `days` dias (default 2).
 * Só considera o mês/ano atual — meses futuros ou passados nunca são "próximos".
 */
export function isDueSoon(
  dueDay: number | null,
  month: number,
  year: number,
  days = 2,
): boolean {
  if (!dueDay) return false;
  const now = new Date();
  // Só aplica no mês/ano sendo visualizado quando coincide com hoje
  if (now.getFullYear() !== year || now.getMonth() + 1 !== month) return false;
  const today = now.getDate();
  const diff = dueDay - today;
  return diff >= 0 && diff <= days;
}

/**
 * Calcula o número da parcela atual de forma dinâmica.
 * Se `installment_start_month/year` estiver preenchido, calcula com base no mês selecionado.
 * Caso contrário, cai de volta para o valor estático armazenado.
 *
 * Retorna null se a parcela ainda não começou ou já terminou.
 */
export function computeInstallment(
  bill: FixedBill,
  viewMonth: number,
  viewYear: number,
): { current: number; total: number } | null {
  if (!bill.installment_total) return null;

  if (bill.installment_start_month != null && bill.installment_start_year != null) {
    const elapsed =
      (viewYear - bill.installment_start_year) * 12 +
      (viewMonth - bill.installment_start_month);
    const current = elapsed + 1; // mês de início = parcela 1

    if (current < 1 || current > bill.installment_total) return null;
    return { current, total: bill.installment_total };
  }

  // Fallback: valor estático
  if (bill.installment_current != null) {
    return { current: bill.installment_current, total: bill.installment_total };
  }

  return null;
}

/**
 * Dado um mês/ano de início e um número de parcelas, retorna o mês/ano final.
 */
export function installmentEndDate(
  startMonth: number, startYear: number, total: number
): { month: number; year: number } {
  const totalMonthsIndex = startYear * 12 + startMonth - 1 + (total - 1);
  return {
    month: (totalMonthsIndex % 12) + 1,
    year: Math.floor(totalMonthsIndex / 12),
  };
}

// ── Configuração do saldo acumulado ──────────────────────────────────────────

export interface AccumuladoConfig {
  /** Valor inicial já existente antes do período de acumulação (ex.: poupança) */
  saldoInicial: number;
  /** Mês a partir do qual começa a acumulação (1-12) */
  startMonth: number;
  /** Ano a partir do qual começa a acumulação */
  startYear: number;
}

const ACC_KEY = "renda_acc_config";

export function getAccConfig(): AccumuladoConfig {
  if (typeof window === "undefined") {
    return { saldoInicial: 0, startMonth: 1, startYear: new Date().getFullYear() };
  }
  try {
    const raw = localStorage.getItem(ACC_KEY);
    if (raw) {
      return {
        saldoInicial: 0,
        startMonth: 1,
        startYear: new Date().getFullYear(),
        ...JSON.parse(raw),
      };
    }
  } catch {}
  return { saldoInicial: 0, startMonth: 1, startYear: new Date().getFullYear() };
}

export function saveAccConfig(config: AccumuladoConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACC_KEY, JSON.stringify(config));
  }
}
