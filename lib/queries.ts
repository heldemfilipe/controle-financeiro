import { supabase } from "./supabase";
import { capitalizeWords, getLocalDateString, isSourceActiveInMonth, normalizeText } from "./utils";
import { buildProducts, type ProductTxRow } from "./products";
import type {
  IncomeSource, IncomeSourceAmount, FixedBill, CreditCard, CardTransaction, Category,
  MonthlyBillPayment, MonthlyCardPayment, MonthlyIncome, MonthlyBalanceOverride, BillAdvance,
  ProductSuggestion, SavedProduct,
} from "@/types";

const PAGE_SIZE = 1000;

/** Busca todas as linhas em páginas: o Supabase limita cada resposta a 1000 */
async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

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

// ─── Configurações compartilhadas ─────────────────────────────────────────────

export async function getAppSetting<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    // Migration pendente: segue com a cópia do navegador
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return (data?.value ?? null) as T | null;
}

export async function saveAppSetting(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
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

/** Encerra a receita: deixa de valer no mês informado, e os anteriores seguem no saldo */
export async function endIncomeSource(id: string, month: number, year: number) {
  const { error } = await supabase
    .from("income_sources")
    .update({ stop_month: month, stop_year: year })
    .eq("id", id);
  if (error) throw error;
}

/** Remove a receita de todos os meses, inclusive dos passados */
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
  if (error) {
    // Migration pendente: segue só com o valor base. Outras falhas não podem passar
    // em silêncio, porque a renda e o saldo ficariam errados sem aviso.
    if (isMissingTableError(error)) return [];
    throw error;
  }
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

/** Encerra a conta no mês informado ou, com null, volta a valer sem data de fim */
export async function setFixedBillStop(id: string, stop: { month: number; year: number } | null) {
  const { error } = await supabase
    .from("fixed_bills")
    .update({ stop_month: stop?.month ?? null, stop_year: stop?.year ?? null })
    .eq("id", id);
  if (error) throw error;
}

/** Remove a conta de todos os meses, inclusive dos passados */
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

type InstallmentRef = Pick<CardTransaction, "id" | "purchase_id" | "installment_current">;

/** Remove esta parcela e todas as seguintes da mesma compra */
export async function deleteCardTransactionsFollowing(tx: InstallmentRef) {
  // Sem purchase_id não há como saber quais parcelas são da compra: mexe só nesta
  if (!tx.purchase_id) return deleteCardTransaction(tx.id);
  const { error } = await supabase
    .from("card_transactions")
    .delete()
    .eq("purchase_id", tx.purchase_id)
    .gte("installment_current", tx.installment_current);
  if (error) throw error;
}

/** Aplica a alteração nesta parcela e em todas as seguintes da mesma compra */
export async function updateFollowingInstallments(
  tx: InstallmentRef,
  changes: Pick<Partial<CardTransaction>, "amount" | "category" | "description">,
) {
  const query = supabase.from("card_transactions").update(withCapitalizedDescription(changes));
  const { error } = tx.purchase_id
    ? await query.eq("purchase_id", tx.purchase_id).gte("installment_current", tx.installment_current)
    : await query.eq("id", tx.id);
  if (error) throw error;
}

// ─── Produtos salvos (autocomplete) ───────────────────────────────────────────

const MISSING_PRODUCTS_TABLE =
  "Tabela saved_products não encontrada. Rode supabase/migration_saved_products.sql no Supabase.";

function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}

function throwProductError(error: { code?: string }): never {
  throw isMissingTableError(error) ? new Error(MISSING_PRODUCTS_TABLE) : error;
}

/** Todas as despesas de cartão, da mais recente para a mais antiga */
function getExpenseRows(): Promise<ProductTxRow[]> {
  return fetchAllPages<ProductTxRow>((from, to) => supabase
    .from("card_transactions")
    .select("description, category, amount")
    .lt("amount", 0)           // apenas despesas (excluir créditos/estornos)
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to));
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
      paid_date: paid ? getLocalDateString() : null,
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
      paid_date: paid ? getLocalDateString() : null,
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
export function getCardTransactionsByYear(year: number): Promise<CardTransaction[]> {
  return fetchAllPages<CardTransaction>((from, to) => supabase
    .from("card_transactions")
    .select("*")
    .eq("year", year)
    .order("month", { ascending: true })
    .order("id")
    .range(from, to));
}

/** Receitas lançadas em cada mês do ano (query única para o saldo anual) */
export function getMonthlyIncomesByYear(year: number): Promise<MonthlyIncome[]> {
  return fetchAllPages<MonthlyIncome>((from, to) => supabase
    .from("monthly_incomes")
    .select("*")
    .eq("year", year)
    .order("id")
    .range(from, to));
}

/** Pagamentos de contas em cada mês do ano (query única para o saldo anual) */
export function getMonthlyBillPaymentsByYear(year: number): Promise<MonthlyBillPayment[]> {
  return fetchAllPages<MonthlyBillPayment>((from, to) => supabase
    .from("monthly_bill_payments")
    .select("*")
    .eq("year", year)
    .order("id")
    .range(from, to));
}
