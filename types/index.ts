/** Identificador livre do "dono" do recurso (ex: "pessoa1", "joao", "casal"). */
export type Owner = string;
export type IncomeType = "salary" | "extra" | "other";

export interface AppUser {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "user";
  banned: boolean;
  created_at: string;
}
export type BillPeriod = "1-15" | "16-30";

export interface Category {
  id: string;
  name: string;
  color: string;
  active: boolean;
  created_at: string;
}

export interface IncomeSource {
  id: string;
  name: string;
  base_amount: number;
  due_day: number | null;
  owner: Owner;
  type: IncomeType;
  active: boolean;
  /** false = receita avulsa, aparece só no mês one_time_month/year */
  is_recurring: boolean;
  one_time_month: number | null;
  one_time_year: number | null;
  created_at: string;
}

export interface FixedBill {
  id: string;
  name: string;
  amount: number;
  due_day: number | null;
  /** Nome da categoria (texto livre após migration v2) */
  category: string;
  period: BillPeriod | null;
  installment_current: number | null;
  installment_total: number | null;
  /** Mês em que ocorreu a 1ª parcela (para cálculo dinâmico) */
  installment_start_month: number | null;
  installment_start_year: number | null;
  notes: string | null;
  is_tithe: boolean;
  active: boolean;
  created_at: string;
}

export interface CreditCard {
  id: string;
  name: string;
  owner: Owner;
  bank: string;
  due_day: number;
  color: string;
  active: boolean;
  created_at: string;
}

export interface CardTransaction {
  id: string;
  card_id: string;
  description: string;
  amount: number;
  transaction_date: string | null;
  installment_current: number;
  installment_total: number;
  month: number;
  year: number;
  created_at: string;
  credit_cards?: CreditCard;
}

export interface MonthlyBillPayment {
  id: string;
  bill_id: string;
  month: number;
  year: number;
  paid: boolean;
  paid_date: string | null;
  amount: number | null;
  notes: string | null;
  created_at: string;
  fixed_bills?: FixedBill;
}

export interface MonthlyCardPayment {
  id: string;
  card_id: string;
  month: number;
  year: number;
  paid: boolean;
  paid_date: string | null;
  total_amount: number;
  created_at: string;
  credit_cards?: CreditCard;
}

export interface MonthlyIncome {
  id: string;
  source_id: string;
  month: number;
  year: number;
  amount: number;
  received: boolean;
  received_date: string | null;
  notes: string | null;
  created_at: string;
  income_sources?: IncomeSource;
}

export interface MonthSummary {
  month: number;
  year: number;
  total_income: number;
  total_expenses: number;
  total_cards: number;
  balance: number;
}

export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril",
  "Maio", "Junho", "Julho", "Agosto",
  "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const MONTH_SHORT = [
  "Jan", "Fev", "Mar", "Abr",
  "Mai", "Jun", "Jul", "Ago",
  "Set", "Out", "Nov", "Dez",
];
