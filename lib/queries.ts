import { supabase } from "./supabase";
import { capitalizeWords, isSourceActiveInMonth, normalizeText } from "./utils";
import { buildProducts, type ProductTxRow } from "./products";
import type {
  IncomeSource, IncomeSourceAmount, FixedBill, CreditCard, CardTransaction, Category,
  MonthlyBillPayment, MonthlyCardPayment, MonthlyIncome, MonthlyBalanceOverride, BillAdvance,
  ProductSuggestion, SavedProduct,
} from "@/types";

// ─── Padronização de texto ao salvar ──────────────────────────────────────────

function withCapitalizedName<T extends { name?: string }>(item: T): T {
  return item.name ? { ...item, name: capitalizeWords(item.name) } : item;
}

function withCapitalizedDescription<T extends { description?: string }>(item: T): T {
  return item.description ? { ...item, description: capitalizeWords(item.description) } : item;
}

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

  // Filtra: recorrentes (a partir de start_month/year, se definido); avulsas só no mês/ano correto
  return all.filter(s => isSourceActiveInMonth(s, month, year));
}

export async function upsertIncomeSource(source: Partial<IncomeSource>) {
  const { data, error } = await supabase
    .from("income_sources")
    .upsert(withCapitalizedName(source))
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

// ─── Income Source Amounts (histórico de valores por data de vigência) ─────────

export async function getIncomeSourceAmounts(sourceId?: string): Promise<IncomeSourceAmount[]> {
  let query = supabase
    .from("income_source_amounts")
    .select("*")
    .order("effective_year", { ascending: false })
    .order("effective_month", { ascending: false });
  if (sourceId) query = (query as any).eq("source_id", sourceId);
  const { data, error } = await query;
  // Retorna [] se tabela ainda não existe no banco (migration pendente)
  if (error) return [];
  return (data ?? []) as IncomeSourceAmount[];
}

export async function upsertIncomeSourceAmount(entry: Partial<IncomeSourceAmount>): Promise<IncomeSourceAmount> {
  const { data, error } = await supabase
    .from("income_source_amounts")
    .upsert(entry, { onConflict: "source_id,effective_month,effective_year" })
    .select()
    .single();
  if (error) throw error;
  return data as IncomeSourceAmount;
}

export async function deleteIncomeSourceAmount(id: string): Promise<void> {
  const { error } = await supabase
    .from("income_source_amounts")
    .delete()
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
    .upsert(withCapitalizedName(bill))
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
    .upsert(withCapitalizedName(card))
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
    .upsert(withCapitalizedDescription(tx))
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

type InstallmentRef = Pick<
  CardTransaction,
  "card_id" | "description" | "installment_total" | "installment_current"
>;

/** IDs desta parcela e das seguintes, ignorando maiúsculas e acentos na descrição */
async function getFollowingInstallmentIds(tx: InstallmentRef): Promise<string[]> {
  const { data, error } = await supabase
    .from("card_transactions")
    .select("id, description")
    .eq("card_id", tx.card_id)
    .eq("installment_total", tx.installment_total)
    .gte("installment_current", tx.installment_current);
  if (error) throw error;
  const key = normalizeText(tx.description);
  return (data ?? []).filter(t => normalizeText(t.description) === key).map(t => t.id);
}

/** Remove esta parcela e todas as seguintes da mesma compra */
export async function deleteCardTransactionsFollowing(tx: InstallmentRef) {
  const ids = await getFollowingInstallmentIds(tx);
  if (!ids.length) return;
  const { error } = await supabase
    .from("card_transactions")
    .delete()
    .in("id", ids);
  if (error) throw error;
}

/** Propaga categoria para esta parcela e todas as seguintes */
export async function updateCategoryForFollowing(tx: InstallmentRef, category: string | null) {
  const ids = await getFollowingInstallmentIds(tx);
  if (!ids.length) return;
  const { error } = await supabase
    .from("card_transactions")
    .update({ category })
    .in("id", ids);
  if (error) throw error;
}

/** Propaga o valor para esta parcela e todas as seguintes da mesma compra */
export async function updateAmountForFollowing(tx: InstallmentRef, amount: number) {
  const ids = await getFollowingInstallmentIds(tx);
  if (!ids.length) return;
  const { error } = await supabase
    .from("card_transactions")
    .update({ amount })
    .in("id", ids);
  if (error) throw error;
}

// ─── Produtos salvos (autocomplete) ───────────────────────────────────────────

const PAGE_SIZE = 1000;
const MISSING_PRODUCTS_TABLE =
  "Tabela saved_products não encontrada. Rode supabase/migration_saved_products.sql no Supabase.";

function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}

function throwProductError(error: { code?: string }): never {
  throw isMissingTableError(error) ? new Error(MISSING_PRODUCTS_TABLE) : error;
}

/** Todas as despesas de cartão, da mais recente para a mais antiga */
async function getExpenseRows(): Promise<ProductTxRow[]> {
  const rows: ProductTxRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("card_transactions")
      .select("description, category, amount")
      .lt("amount", 0)           // apenas despesas (excluir créditos/estornos)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as ProductTxRow[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function getSavedProducts(): Promise<SavedProduct[]> {
  const { data, error } = await supabase.from("saved_products").select("*");
  if (error) {
    // Sem a migration o autocomplete segue funcionando só com o histórico
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data ?? []) as SavedProduct[];
}

/** Todos os produtos do histórico, inclusive os ocultos */
export async function getProducts(): Promise<ProductSuggestion[]> {
  const [rows, saved] = await Promise.all([getExpenseRows(), getSavedProducts()]);
  return buildProducts(rows, saved);
}

/** Produtos sugeridos ao lançar (sem os ocultos) */
export async function getTransactionSuggestions(): Promise<ProductSuggestion[]> {
  return (await getProducts()).filter(p => !p.hidden);
}

export interface ProductInput {
  name: string;
  category: string | null;
  amount: number | null;
}

/**
 * Cria ou altera um produto. Renomear atualiza os lançamentos já feitos, para que
 * o histórico continue agrupado; o valor vale apenas para os próximos lançamentos.
 * A categoria só muda nos lançamentos existentes com `applyCategoryToHistory`.
 */
export async function saveProduct(
  original: ProductSuggestion | null,
  input: ProductInput,
  { applyCategoryToHistory = false } = {},
): Promise<ProductSuggestion> {
  const name = capitalizeWords(input.name);
  const key = normalizeText(name);
  const keyChanged = !!original && original.key !== key;

  // Guarda só o que mudou: o resto continua acompanhando o histórico
  const payload: Partial<SavedProduct> = { key, name, hidden: false };
  if (!original || keyChanged || input.category !== original.category) payload.category = input.category;
  if (!original || keyChanged || input.amount !== original.amount) payload.amount = input.amount;

  const { error: saveError } = await supabase
    .from("saved_products")
    .upsert(payload, { onConflict: "key" });
  if (saveError) throwProductError(saveError);

  if (original) {
    const staleNames = original.variants.filter(v => v !== name);
    if (staleNames.length) {
      const { error } = await supabase
        .from("card_transactions")
        .update({ description: name })
        .in("description", staleNames);
      if (error) throw error;
    }
    if (applyCategoryToHistory) {
      const { error } = await supabase
        .from("card_transactions")
        .update({ category: input.category })
        .eq("description", name);
      if (error) throw error;
    }
    if (keyChanged) {
      const { error } = await supabase.from("saved_products").delete().eq("key", original.key);
      if (error) throw error;
    }
  }

  return {
    key,
    description: name,
    category: input.category,
    amount: input.amount ?? 0,
    count: original?.count ?? 0,
    hidden: false,
    variants: [name],
  };
}

/** Oculta ou mostra um produto nas sugestões; os lançamentos não mudam */
export async function setProductHidden(product: ProductSuggestion, hidden: boolean) {
  const { error } = await supabase
    .from("saved_products")
    .upsert({ key: product.key, name: product.description, hidden }, { onConflict: "key" });
  if (error) throwProductError(error);
}

/** Insere múltiplas parcelas de uma vez (compra parcelada) */
export async function insertCardTransactions(txs: Partial<CardTransaction>[]) {
  const { data, error } = await supabase
    .from("card_transactions")
    .insert(txs.map(withCapitalizedDescription))
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

/** Remove o ajuste de valor de uma fonte de renda num mês específico (volta ao valor padrão). */
export async function deleteMonthlyIncome(sourceId: string, month: number, year: number) {
  const { error } = await supabase
    .from("monthly_incomes")
    .delete()
    .eq("source_id", sourceId)
    .eq("month", month)
    .eq("year", year);
  if (error) throw error;
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

// ─── Bill Advances (Adiantamentos) ───────────────────────────────────────────

/** Retorna adiantamentos FEITOS em um determinado mês (despesas extras deste mês) */
export async function getBillAdvancesMadeIn(month: number, year: number): Promise<BillAdvance[]> {
  const { data, error } = await supabase
    .from("bill_advances")
    .select("*, fixed_bills(*)")
    .eq("paid_month", month)
    .eq("paid_year", year);
  if (error) throw error;
  return (data ?? []) as BillAdvance[];
}

/** Retorna adiantamentos PARA um determinado mês (contas pré-pagas neste mês) */
export async function getBillAdvancesForMonth(month: number, year: number): Promise<BillAdvance[]> {
  const { data, error } = await supabase
    .from("bill_advances")
    .select("*, fixed_bills(*)")
    .eq("target_month", month)
    .eq("target_year", year);
  if (error) throw error;
  return (data ?? []) as BillAdvance[];
}

/** Cria um adiantamento de conta */
export async function createBillAdvance(
  billId: string,
  targetMonth: number,
  targetYear: number,
  paidMonth: number,
  paidYear: number,
  amount: number,
  notes?: string,
): Promise<BillAdvance> {
  const { data, error } = await supabase
    .from("bill_advances")
    .upsert({
      bill_id: billId,
      target_month: targetMonth,
      target_year: targetYear,
      paid_month: paidMonth,
      paid_year: paidYear,
      amount,
      notes: notes ?? null,
    }, { onConflict: "bill_id,target_month,target_year" })
    .select("*, fixed_bills(*)")
    .single();
  if (error) throw error;
  return data as BillAdvance;
}

/** Remove um adiantamento */
export async function deleteBillAdvance(id: string): Promise<void> {
  const { error } = await supabase
    .from("bill_advances")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Retorna todos os adiantamentos FEITOS em um determinado ano */
export async function getBillAdvancesMadeInYear(year: number): Promise<BillAdvance[]> {
  const { data, error } = await supabase
    .from("bill_advances")
    .select("*, fixed_bills(*)")
    .eq("paid_year", year);
  if (error) throw error;
  return (data ?? []) as BillAdvance[];
}

/** Retorna todos os adiantamentos PARA um determinado ano */
export async function getBillAdvancesForYear(year: number): Promise<BillAdvance[]> {
  const { data, error } = await supabase
    .from("bill_advances")
    .select("*, fixed_bills(*)")
    .eq("target_year", year);
  if (error) throw error;
  return (data ?? []) as BillAdvance[];
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
