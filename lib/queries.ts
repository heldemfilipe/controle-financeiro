import { supabase } from "./supabase";
import type {
  IncomeSource, FixedBill, CreditCard, CardTransaction, Category,
  MonthlyBillPayment, MonthlyCardPayment, MonthlyIncome, MonthlyBalanceOverride,
} from "@/types";

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data as Category[];
}

export async function upsertCategory(cat: Partial<Category>) {
  const { data, error } = await supabase
    .from("categories")
    .upsert(cat)
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase
    .from("categories")
    .update({ active: false })
    .eq("id", id);
  if (error) throw error;
}

// ─── Income Sources ───────────────────────────────────────────────────────────

/** Retorna fontes de renda ativas para o mês.
 *  Inclui recorrentes + avulsas do mês/ano selecionado. */
export async function getIncomeSources(month?: number, year?: number) {
  const { data, error } = await supabase
    .from("income_sources")
    .select("*")
    .eq("active", true)
    .order("due_day", { ascending: true });
  if (error) throw error;

  const all = data as IncomeSource[];

  if (month == null || year == null) return all;

  // Filtra: recorrentes sempre aparecem; avulsas só no mês/ano correto
  return all.filter(s =>
    s.is_recurring !== false ||
    (s.one_time_month === month && s.one_time_year === year)
  );
}

export async function upsertIncomeSource(source: Partial<IncomeSource>) {
  const { data, error } = await supabase
    .from("income_sources")
    .upsert(source)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteIncomeSource(id: string) {
  const { error } = await supabase
    .from("income_sources")
    .update({ active: false })
    .eq("id", id);
  if (error) throw error;
}

// ─── Fixed Bills ──────────────────────────────────────────────────────────────

export async function getFixedBills() {
  const { data, error } = await supabase
    .from("fixed_bills")
    .select("*")
    .eq("active", true)
    .order("period")
    .order("category")
    .order("due_day", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as FixedBill[];
}

export async function upsertFixedBill(bill: Partial<FixedBill>) {
  const { data, error } = await supabase
    .from("fixed_bills")
    .upsert(bill)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFixedBill(id: string) {
  const { error } = await supabase
    .from("fixed_bills")
    .update({ active: false })
    .eq("id", id);
  if (error) throw error;
}

// ─── Credit Cards ─────────────────────────────────────────────────────────────

export async function getCreditCards() {
  const { data, error } = await supabase
    .from("credit_cards")
    .select("*")
    .eq("active", true)
    .order("due_day", { ascending: true });
  if (error) throw error;
  return data as CreditCard[];
}

export async function upsertCreditCard(card: Partial<CreditCard>) {
  const { data, error } = await supabase
    .from("credit_cards")
    .upsert(card)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Card Transactions ────────────────────────────────────────────────────────

export async function getCardTransactions(month: number, year: number) {
  const { data, error } = await supabase
    .from("card_transactions")
    .select("*, credit_cards(*)")
    .eq("month", month)
    .eq("year", year)
    .order("transaction_date", { ascending: false });
  if (error) throw error;
  return data as CardTransaction[];
}

export async function getCardTransactionsByCard(cardId: string, month: number, year: number) {
  const { data, error } = await supabase
    .from("card_transactions")
    .select("*")
    .eq("card_id", cardId)
    .eq("month", month)
    .eq("year", year)
    .order("transaction_date", { ascending: false });
  if (error) throw error;
  return data as CardTransaction[];
}

export async function upsertCardTransaction(tx: Partial<CardTransaction>) {
  const { data, error } = await supabase
    .from("card_transactions")
    .upsert(tx)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCardTransaction(id: string) {
  const { error } = await supabase
    .from("card_transactions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Remove esta parcela e todas as seguintes da mesma compra */
export async function deleteCardTransactionsFollowing(
  tx: Pick<CardTransaction, "card_id" | "description" | "installment_total" | "installment_current">
) {
  const { error } = await supabase
    .from("card_transactions")
    .delete()
    .eq("card_id", tx.card_id)
    .eq("description", tx.description)
    .eq("installment_total", tx.installment_total)
    .gte("installment_current", tx.installment_current);
  if (error) throw error;
}

/** Propaga categoria para esta parcela e todas as seguintes */
export async function updateCategoryForFollowing(
  tx: Pick<CardTransaction, "card_id" | "description" | "installment_total" | "installment_current">,
  category: string | null
) {
  const { error } = await supabase
    .from("card_transactions")
    .update({ category })
    .eq("card_id", tx.card_id)
    .eq("description", tx.description)
    .eq("installment_total", tx.installment_total)
    .gte("installment_current", tx.installment_current);
  if (error) throw error;
}

/** Propaga o valor para esta parcela e todas as seguintes da mesma compra */
export async function updateAmountForFollowing(
  tx: Pick<CardTransaction, "card_id" | "description" | "installment_total" | "installment_current">,
  amount: number
) {
  const { error } = await supabase
    .from("card_transactions")
    .update({ amount })
    .eq("card_id", tx.card_id)
    .eq("description", tx.description)
    .eq("installment_total", tx.installment_total)
    .gte("installment_current", tx.installment_current);
  if (error) throw error;
}

/** Insere múltiplas parcelas de uma vez (compra parcelada) */
export async function insertCardTransactions(txs: Partial<CardTransaction>[]) {
  const { data, error } = await supabase
    .from("card_transactions")
    .insert(txs)
    .select();
  if (error) throw error;
  return data;
}

// ─── Monthly Bill Payments ────────────────────────────────────────────────────

export async function getMonthlyBillPayments(month: number, year: number) {
  const { data, error } = await supabase
    .from("monthly_bill_payments")
    .select("*, fixed_bills(*)")
    .eq("month", month)
    .eq("year", year);
  if (error) throw error;
  return data as MonthlyBillPayment[];
}

export async function upsertMonthlyBillPayment(payment: Partial<MonthlyBillPayment>) {
  const { data, error } = await supabase
    .from("monthly_bill_payments")
    .upsert(payment, { onConflict: "bill_id,month,year" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleBillPaid(
  billId: string, month: number, year: number, paid: boolean, amount: number
) {
  const { data, error } = await supabase
    .from("monthly_bill_payments")
    .upsert({
      bill_id: billId, month, year, paid, amount,
      paid_date: paid ? new Date().toISOString().split("T")[0] : null,
    }, { onConflict: "bill_id,month,year" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Atualiza somente o valor (e observação) de um pagamento do mês, sem alterar o status pago */
export async function updateBillPaymentAmount(
  billId: string, month: number, year: number, amount: number, notes?: string
) {
  const { data, error } = await supabase
    .from("monthly_bill_payments")
    .upsert(
      { bill_id: billId, month, year, amount, notes: notes ?? null },
      { onConflict: "bill_id,month,year" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Monthly Card Payments ────────────────────────────────────────────────────

export async function getMonthlyCardPayments(month: number, year: number) {
  const { data, error } = await supabase
    .from("monthly_card_payments")
    .select("*, credit_cards(*)")
    .eq("month", month)
    .eq("year", year);
  if (error) throw error;
  return data as MonthlyCardPayment[];
}

export async function toggleCardPaid(
  cardId: string, month: number, year: number, paid: boolean, totalAmount: number
) {
  const { data, error } = await supabase
    .from("monthly_card_payments")
    .upsert({
      card_id: cardId, month, year, paid, total_amount: totalAmount,
      paid_date: paid ? new Date().toISOString().split("T")[0] : null,
    }, { onConflict: "card_id,month,year" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Monthly Incomes ──────────────────────────────────────────────────────────

export async function getMonthlyIncomes(month: number, year: number) {
  const { data, error } = await supabase
    .from("monthly_incomes")
    .select("*, income_sources(*)")
    .eq("month", month)
    .eq("year", year);
  if (error) throw error;
  return data as MonthlyIncome[];
}

export async function upsertMonthlyIncome(income: Partial<MonthlyIncome>) {
  const { data, error } = await supabase
    .from("monthly_incomes")
    .upsert(income, { onConflict: "source_id,month,year" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleIncomeReceived(
  sourceId: string, month: number, year: number, received: boolean, amount: number
) {
  const { data, error } = await supabase
    .from("monthly_incomes")
    .upsert({
      source_id: sourceId, month, year, received, amount,
      received_date: received ? new Date().toISOString().split("T")[0] : null,
    }, { onConflict: "source_id,month,year" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Dashboard / Análise ──────────────────────────────────────────────────────

/** Resumo anual: 12 meses com totais de renda, contas e cartões */
export async function getYearlySummary(year: number) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const results = await Promise.all(
    months.map(async (month) => {
      const [incomes, bills, txs] = await Promise.all([
        getMonthlyIncomes(month, year),
        getMonthlyBillPayments(month, year),
        getCardTransactions(month, year),
      ]);
      const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
      const totalBills  = bills.reduce((s, b) => s + (b.amount ?? b.fixed_bills?.amount ?? 0), 0);
      const totalCards  = txs.reduce((s, t) => s + Math.abs(t.amount), 0);
      return { month, year, totalIncome, totalBills, totalCards };
    })
  );
  return results;
}

/** Totais de transações de cartão por mês para um ano inteiro */
export async function getCardTotalsByMonth(year: number): Promise<Record<number, number>> {
  const results: Record<number, number> = {};
  await Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const m = i + 1;
      const txs = await getCardTransactions(m, year);
      results[m] = txs.reduce((s, t) => s + Math.abs(t.amount), 0);
    })
  );
  return results;
}

// ─── Balance Overrides ───────────────────────────────────────────────────────

export async function getBalanceOverride(month: number, year: number) {
  const { data, error } = await supabase
    .from("monthly_balance_overrides")
    .select("*")
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  return data as MonthlyBalanceOverride | null;
}

export async function getBalanceOverrides(year: number) {
  const { data, error } = await supabase
    .from("monthly_balance_overrides")
    .select("*")
    .eq("year", year)
    .order("month");
  if (error) throw error;
  return data as MonthlyBalanceOverride[];
}

export async function upsertBalanceOverride(override: Partial<MonthlyBalanceOverride>) {
  const { data, error } = await supabase
    .from("monthly_balance_overrides")
    .upsert(override, { onConflict: "month,year" })
    .select()
    .single();
  if (error) throw error;
  return data as MonthlyBalanceOverride;
}

export async function deleteBalanceOverride(month: number, year: number) {
  const { error } = await supabase
    .from("monthly_balance_overrides")
    .delete()
    .eq("month", month)
    .eq("year", year);
  if (error) throw error;
}

/** Todas as transações de cartão de um ano (query única para análise anual) */
export async function getCardTransactionsByYear(year: number): Promise<CardTransaction[]> {
  const { data, error } = await supabase
    .from("card_transactions")
    .select("*")
    .eq("year", year)
    .order("month", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CardTransaction[];
}
