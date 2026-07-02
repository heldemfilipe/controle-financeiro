"use client";

import { useEffect, useState } from "react";
import { TrendingUp, FileText, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { useToast } from "@/components/ui/Toast";
import {
  getIncomeSources, upsertIncomeSource, deleteIncomeSource,
  getFixedBills, upsertFixedBill, deleteFixedBill,
  getCategories,
  getCreditCards, upsertCreditCard,
  getCardTransactions, upsertCardTransaction, deleteCardTransaction,
  deleteCardTransactionsFollowing, updateCategoryForFollowing, updateAmountForFollowing,
  insertCardTransactions,
  getMonthlyIncomes, upsertMonthlyIncome, deleteMonthlyIncome,
  getTransactionSuggestions, upsertMonthlyBillPayment, getIncomeSourceAmounts,
} from "@/lib/queries";
import { type TxSuggestion } from "@/components/ui/DescriptionAutocomplete";
import { getCurrentMonth, resolveSourceAmount } from "@/lib/utils";
import { getOwners, type Owner } from "@/lib/owners";
import type {
  IncomeSource, IncomeSourceAmount, FixedBill, CreditCard as CreditCardType,
  CardTransaction, MonthlyIncome, Category, BillPeriod,
} from "@/types";

import { ReceitasTab } from "@/components/lancamentos/tabs/ReceitasTab";
import { ContasTab } from "@/components/lancamentos/tabs/ContasTab";
import { CartoesTab } from "@/components/lancamentos/tabs/CartoesTab";
import { IncomeModal } from "@/components/lancamentos/IncomeModal";
import { MonthIncomeModal } from "@/components/lancamentos/MonthIncomeModal";
import { BillModal } from "@/components/lancamentos/BillModal";
import { CardModal } from "@/components/lancamentos/CardModal";
import { TransactionModal } from "@/components/lancamentos/TransactionModal";
import { DeleteConfirmModal, type DeleteTarget } from "@/components/lancamentos/DeleteConfirmModal";

type Tab = "receitas" | "contas" | "cartoes";

export default function LancamentosPage() {
  const { month: cm, year: cy } = getCurrentMonth();
  const [month, setMonth] = useState(cm);
  const [year, setYear] = useState(cy);
  const [tab, setTab] = useState<Tab>("receitas");

  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [sourceAmounts, setSourceAmounts] = useState<IncomeSourceAmount[]>([]);
  const [fixedBills,    setFixedBills]    = useState<FixedBill[]>([]);
  const [creditCards,   setCreditCards]   = useState<CreditCardType[]>([]);
  const [cardTxs,       setCardTxs]       = useState<CardTransaction[]>([]);
  const [monthlyIncomes,setMonthlyIncomes]= useState<MonthlyIncome[]>([]);
  const [categories,    setCategories]    = useState<Category[]>([]);

  // Modals
  const [incomeModal, setIncomeModal] = useState(false);
  const [billModal,   setBillModal]   = useState(false);
  const [cardModal,   setCardModal]   = useState(false);
  const [txModal,     setTxModal]     = useState(false);
  const [editIncome, setEditIncome] = useState<Partial<IncomeSource>>({});
  // Ajuste de valor de uma fonte de renda somente no mês selecionado
  const [monthIncomeModal, setMonthIncomeModal] = useState(false);
  const [monthIncomeSrc, setMonthIncomeSrc] = useState<IncomeSource | null>(null);
  const [monthIncomeAmount, setMonthIncomeAmount] = useState("");
  const [monthIncomeSkip, setMonthIncomeSkip] = useState(false);
  const [editBill,   setEditBill]   = useState<Partial<FixedBill>>({});
  const [editCard,   setEditCard]   = useState<Partial<CreditCardType>>({});
  const [editTx,     setEditTx]     = useState<Partial<CardTransaction>>({});
  const [loading, setLoading] = useState(false);
  const [isCredit, setIsCredit] = useState(false);
  const [propagateCategory, setPropagateCategory] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [txSuggestions, setTxSuggestions] = useState<TxSuggestion[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const { toast } = useToast();

  useEffect(() => { loadAll(); }, [month, year]);

  useEffect(() => {
    setOwners(getOwners());
    getTransactionSuggestions().then(setTxSuggestions).catch(console.error);
  }, []);

  async function loadAll() {
    const [srcs, bills, cats, cards, txs, incomes, srcAmts] = await Promise.all([
      getIncomeSources(month, year),
      getFixedBills(),
      getCategories(),
      getCreditCards(),
      getCardTransactions(month, year),
      getMonthlyIncomes(month, year),
      getIncomeSourceAmounts(),
    ]);
    setIncomeSources(srcs);
    setFixedBills(bills);
    setCategories(cats);
    setCreditCards(cards);
    setCardTxs(txs);
    setMonthlyIncomes(incomes);
    setSourceAmounts(srcAmts);
  }

  // ── Income ──────────────────────────────────────────────────────────────────
  async function saveIncome() {
    const errors: Record<string, string> = {};
    if (!editIncome.name?.trim()) errors.name = "Nome obrigatorio";
    if (!editIncome.base_amount || editIncome.base_amount <= 0) errors.base_amount = "Valor deve ser positivo";
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setFormErrors({});
    setLoading(true);
    try {
      const isRecurring = editIncome.is_recurring !== false;
      await upsertIncomeSource({
        owner: owners[0]?.id ?? "casal", type: "salary", active: true,
        is_recurring: true,
        one_time_month: null, one_time_year: null,
        ...editIncome,
        ...(isRecurring ? {} : {
          is_recurring: false,
          one_time_month: editIncome.one_time_month ?? month,
          one_time_year:  editIncome.one_time_year  ?? year,
        }),
      });
      setIncomeModal(false); setEditIncome({});
      toast(editIncome.id ? "Receita atualizada" : "Receita adicionada");
      await loadAll();
    } catch { toast("Erro ao salvar receita", "error"); }
    setLoading(false);
  }

  function removeIncome(src: IncomeSource) {
    setDeleteTarget({ type: "income", id: src.id, label: src.name });
  }

  // ── Ajuste de valor somente no mês selecionado ────────────────────────────────
  function openMonthIncome(src: IncomeSource) {
    const mi = monthlyIncomes.find(m => m.source_id === src.id);
    const defaultAmt = resolveSourceAmount(src, month, year, sourceAmounts);
    const hasOverride = mi != null && mi.amount !== defaultAmt;
    const skip = hasOverride && mi!.amount === 0;
    setMonthIncomeSrc(src);
    setMonthIncomeSkip(skip);
    setMonthIncomeAmount(skip ? "" : String((mi?.amount ?? defaultAmt) || ""));
    setFormErrors({});
    setMonthIncomeModal(true);
  }

  async function saveMonthIncome() {
    if (!monthIncomeSrc) return;
    const amount = monthIncomeSkip ? 0 : (parseFloat(monthIncomeAmount) || 0);
    if (!monthIncomeSkip && amount <= 0) {
      setFormErrors({ monthAmount: "Valor deve ser positivo (ou use 'sem recebimento')" });
      return;
    }
    setFormErrors({});
    setLoading(true);
    try {
      const mi = monthlyIncomes.find(m => m.source_id === monthIncomeSrc.id);
      await upsertMonthlyIncome({
        source_id: monthIncomeSrc.id, month, year, amount,
        // preserva status de recebimento; se pulou o mês, marca como não recebido
        received: monthIncomeSkip ? false : (mi?.received ?? false),
        received_date: monthIncomeSkip ? null : (mi?.received_date ?? null),
      });
      setMonthIncomeModal(false); setMonthIncomeSrc(null);
      toast(monthIncomeSkip ? "Recebimento removido deste mês" : "Valor ajustado neste mês");
      await loadAll();
    } catch { toast("Erro ao ajustar valor", "error"); }
    setLoading(false);
  }

  async function resetMonthIncome() {
    if (!monthIncomeSrc) return;
    setLoading(true);
    try {
      await deleteMonthlyIncome(monthIncomeSrc.id, month, year);
      setMonthIncomeModal(false); setMonthIncomeSrc(null);
      toast("Valor voltou ao padrão");
      await loadAll();
    } catch { toast("Erro ao restaurar valor", "error"); }
    setLoading(false);
  }

  // ── Bills ────────────────────────────────────────────────────────────────────
  async function saveBill() {
    const errors: Record<string, string> = {};
    if (!editBill.name?.trim()) errors.name = "Nome obrigatorio";
    if (!editBill.amount || editBill.amount <= 0) errors.amount = "Valor deve ser positivo";
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setFormErrors({});
    setLoading(true);
    try {
      let billData: Partial<FixedBill> = { category: "essencial", active: true, ...editBill };
      if (billData.installment_total && billData.installment_current) {
        const monthIdx  = year * 12 + month - 1;
        const startIdx  = monthIdx - (billData.installment_current - 1);
        billData.installment_start_month = (startIdx % 12) + 1;
        billData.installment_start_year  = Math.floor(startIdx / 12);
      }
      await upsertFixedBill(billData);
      setBillModal(false); setEditBill({});
      toast(editBill.id ? "Conta atualizada" : "Conta adicionada");
      await loadAll();
    } catch { toast("Erro ao salvar conta", "error"); }
    setLoading(false);
  }

  function removeBill(bill: FixedBill) {
    setDeleteTarget({ type: "bill", bill });
  }

  // ── Cards ────────────────────────────────────────────────────────────────────
  async function saveCard() {
    const errors: Record<string, string> = {};
    if (!editCard.name?.trim()) errors.name = "Nome obrigatorio";
    if (!editCard.due_day) errors.due_day = "Dia de vencimento obrigatorio";
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setFormErrors({});
    setLoading(true);
    try {
      await upsertCreditCard({ color: "#6366f1", active: true, ...editCard });
      setCardModal(false); setEditCard({});
      toast(editCard.id ? "Cartao atualizado" : "Cartao adicionado");
      await loadAll();
    } catch { toast("Erro ao salvar cartao", "error"); }
    setLoading(false);
  }

  // ── Card Transactions ────────────────────────────────────────────────────────
  async function saveTx() {
    const errors: Record<string, string> = {};
    if (!editTx.card_id) errors.card_id = "Selecione um cartao";
    if (!editTx.description?.trim()) errors.description = "Descricao obrigatoria";
    if (!editTx.amount) errors.amount = "Valor obrigatorio";
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setFormErrors({});
    setLoading(true);

    try {
      const totalInstallments = Math.max(1, editTx.installment_total ?? 1);
      const perInstallment    = Math.abs(Number(editTx.amount));
      const totalAmount       = perInstallment * totalInstallments;
      const category          = editTx.category ?? null;
      // Crédito = valor positivo; despesa = negativo
      const sign = isCredit ? 1 : -1;

      if (editTx.id) {
        // Edição: strip credit_cards (campo de join) e salva
        const { credit_cards: _cc, ...txPayload } = editTx as any;
        const signedAmount = sign * Math.abs(Number(editTx.amount));
        await upsertCardTransaction({ ...txPayload, category, amount: signedAmount });

        if (totalInstallments > 1) {
          const followRef = {
            card_id: txPayload.card_id,
            description: txPayload.description,
            installment_total: txPayload.installment_total,
            installment_current: txPayload.installment_current,
          };
          // Propaga valor automaticamente para parcelas seguintes
          await updateAmountForFollowing(followRef, signedAmount);
          // Propaga categoria se solicitado
          if (propagateCategory) {
            await updateCategoryForFollowing(followRef, category);
          }
        }
      } else if (totalInstallments === 1) {
        // Compra à vista
        await upsertCardTransaction({
          card_id: editTx.card_id!, description: editTx.description!,
          amount: sign * totalAmount, installment_current: 1, installment_total: 1,
          month: editTx.month ?? month,
          year:  editTx.year  ?? year,
          category,
        });
      } else {
        // Compra parcelada: distribui a partir da parcela inicial
        const startInst  = Math.max(1, Math.min(editTx.installment_current ?? 1, totalInstallments));
        const startMonth = editTx.month ?? month;
        const startYear  = editTx.year  ?? year;
        const remaining  = totalInstallments - startInst + 1;
        let m = startMonth, y = startYear;
        const parcelas = Array.from({ length: remaining }, (_, i) => {
          const entry = {
            card_id: editTx.card_id!,
            description: editTx.description!,
            amount: sign * parseFloat(perInstallment.toFixed(2)),
            installment_current: startInst + i,
            installment_total: totalInstallments,
            month: m, year: y,
            category,
          };
          m = m === 12 ? 1 : m + 1;
          if (m === 1) y++;
          return entry;
        });
        await insertCardTransactions(parcelas);
      }

      setTxModal(false); setEditTx({}); setIsCredit(false); setPropagateCategory(false);
      await loadAll();
      // Recarrega sugestões para que a nova descrição apareça imediatamente
      getTransactionSuggestions().then(setTxSuggestions).catch(console.error);
    } catch (err) {
      console.error("Erro ao salvar lançamento:", err);
      alert("Erro ao salvar. Verifique o console.");
    } finally {
      setLoading(false);
    }
  }

  function removeTx(tx: CardTransaction) {
    setDeleteTarget({ type: "tx", tx });
  }

  async function confirmDelete(scope: "this" | "following" | "permanent") {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      if (deleteTarget.type === "income") {
        await deleteIncomeSource(deleteTarget.id);
        toast("Receita removida");
      } else if (deleteTarget.type === "bill") {
        if (scope === "this") {
          await upsertMonthlyBillPayment({ bill_id: deleteTarget.bill.id, month, year, amount: 0 });
          toast("Conta ignorada neste mês");
        } else {
          await deleteFixedBill(deleteTarget.bill.id);
          toast("Conta removida");
        }
      } else if (deleteTarget.type === "tx") {
        if (scope === "following") {
          await deleteCardTransactionsFollowing(deleteTarget.tx);
        } else {
          await deleteCardTransaction(deleteTarget.tx.id);
        }
        toast("Lançamento removido");
      }
      setDeleteTarget(null);
      await loadAll();
    } catch { toast("Erro ao remover", "error"); }
    setLoading(false);
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "receitas", label: "Receitas", icon: TrendingUp },
    { key: "contas", label: "Contas", icon: FileText },
    { key: "cartoes", label: "Cartões", icon: CreditCard },
  ];

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <PageHeader title="Lançamentos" subtitle="Gerencie receitas, contas e cartões">
        <MonthSelector month={month} year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 p-1 rounded-xl w-fit transition-colors">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? "bg-primary-600 text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "receitas" && (
        <ReceitasTab
          incomeSources={incomeSources}
          monthlyIncomes={monthlyIncomes}
          sourceAmounts={sourceAmounts}
          owners={owners}
          month={month}
          year={year}
          onAdd={() => { setEditIncome({}); setIncomeModal(true); }}
          onEdit={(src) => { setEditIncome(src); setIncomeModal(true); }}
          onDelete={removeIncome}
          onAdjustMonth={openMonthIncome}
        />
      )}

      {tab === "contas" && (
        <ContasTab
          fixedBills={fixedBills}
          categories={categories}
          month={month}
          year={year}
          onAdd={() => { setEditBill({}); setBillModal(true); }}
          onAddForPeriod={(period: BillPeriod | null) => {
            setEditBill({ period: period as any });
            setFormErrors({});
            setBillModal(true);
          }}
          onEdit={(bill) => { setEditBill(bill); setBillModal(true); }}
          onDelete={removeBill}
        />
      )}

      {tab === "cartoes" && (
        <CartoesTab
          creditCards={creditCards}
          cardTxs={cardTxs}
          categories={categories}
          owners={owners}
          onAddCard={() => { setEditCard({}); setCardModal(true); }}
          onAddGeneral={() => { setEditTx({ month, year }); setTxModal(true); }}
          onQuickAdd={(cardId) => {
            setEditTx({ card_id: cardId, month, year });
            setIsCredit(false);
            setPropagateCategory(false);
            setFormErrors({});
            setTxModal(true);
          }}
          onEdit={(tx) => {
            setEditTx({ ...tx, amount: Math.abs(tx.amount) });
            setIsCredit(tx.amount > 0);
            setPropagateCategory(false);
            setTxModal(true);
          }}
          onDelete={removeTx}
        />
      )}

      <IncomeModal
        open={incomeModal}
        onClose={() => { setIncomeModal(false); setEditIncome({}); }}
        value={editIncome}
        onChange={(patch) => setEditIncome(p => ({ ...p, ...patch }))}
        onSave={saveIncome}
        saving={loading}
        owners={owners}
        month={month}
        year={year}
      />

      <MonthIncomeModal
        open={monthIncomeModal}
        onClose={() => { setMonthIncomeModal(false); setMonthIncomeSrc(null); setFormErrors({}); }}
        source={monthIncomeSrc}
        month={month}
        year={year}
        monthlyIncomes={monthlyIncomes}
        sourceAmounts={sourceAmounts}
        skip={monthIncomeSkip}
        onSkipChange={setMonthIncomeSkip}
        amount={monthIncomeAmount}
        onAmountChange={setMonthIncomeAmount}
        amountError={formErrors.monthAmount}
        onSave={saveMonthIncome}
        onReset={resetMonthIncome}
        saving={loading}
      />

      <BillModal
        open={billModal}
        onClose={() => { setBillModal(false); setEditBill({}); setFormErrors({}); }}
        value={editBill}
        onChange={(patch) => setEditBill(p => ({ ...p, ...patch }))}
        onSave={saveBill}
        saving={loading}
        categories={categories}
        month={month}
        year={year}
      />

      <CardModal
        open={cardModal}
        onClose={() => { setCardModal(false); setEditCard({}); }}
        value={editCard}
        onChange={(patch) => setEditCard(p => ({ ...p, ...patch }))}
        onSave={saveCard}
        saving={loading}
        owners={owners}
      />

      <TransactionModal
        open={txModal}
        onClose={() => { setTxModal(false); setEditTx({}); setIsCredit(false); setPropagateCategory(false); setFormErrors({}); }}
        value={editTx}
        onChange={(patch) => setEditTx(p => ({ ...p, ...patch }))}
        onSave={saveTx}
        saving={loading}
        creditCards={creditCards}
        categories={categories}
        txSuggestions={txSuggestions}
        isCredit={isCredit}
        onIsCreditChange={setIsCredit}
        propagateCategory={propagateCategory}
        onPropagateCategoryChange={setPropagateCategory}
        month={month}
        year={year}
      />

      <DeleteConfirmModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        saving={loading}
      />
    </div>
  );
}
