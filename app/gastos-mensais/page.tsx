"use client";

import { useEffect, useState } from "react";
import { Download, LayoutList, LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { useToast } from "@/components/ui/Toast";
import {
  getFixedBills, getMonthlyBillPayments, toggleBillPaid, updateBillPaymentAmount,
  getCreditCards, getCardTransactions, getMonthlyCardPayments, toggleCardPaid,
  getMonthlyIncomes, getIncomeSources, getIncomeSourceAmounts,
  getBalanceOverride, upsertBalanceOverride, deleteBalanceOverride,
  getBillAdvancesMadeIn, getBillAdvancesForMonth, createBillAdvance, deleteBillAdvance,
} from "@/lib/queries";
import { getCurrentMonth, isOverdue, computeInstallment, getAccConfig, saveAccConfig, resolveSourceAmount } from "@/lib/utils";
import type { AccumuladoConfig } from "@/lib/utils";
import { computePrevBalance, clearBalanceCache } from "@/lib/balance";
import { calcTithe } from "@/lib/gastos-mensais/tithe";
import { MONTHS } from "@/types";
import type {
  FixedBill, CreditCard as CCType, MonthlyBillPayment,
  MonthlyCardPayment, IncomeSource, IncomeSourceAmount, MonthlyIncome, CardTransaction, MonthlyBalanceOverride, BillAdvance,
} from "@/types";

import { FluxoCaixa } from "@/components/gastos-mensais/FluxoCaixa";
import { TitheSection } from "@/components/gastos-mensais/TitheSection";
import { QuinzenaSection } from "@/components/gastos-mensais/QuinzenaSection";
import { SpreadsheetView } from "@/components/gastos-mensais/SpreadsheetView";
import { BalanceOverrideModal, type OverrideForm } from "@/components/gastos-mensais/modals/BalanceOverrideModal";
import { AccConfigModal } from "@/components/gastos-mensais/modals/AccConfigModal";
import { EditBillAmountModal, type EditBillAmountTarget } from "@/components/gastos-mensais/modals/EditBillAmountModal";
import { AdvancePaymentModal, type AdvanceTarget } from "@/components/gastos-mensais/modals/AdvancePaymentModal";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers puros (sem hooks — podem ficar fora do componente)
// ─────────────────────────────────────────────────────────────────────────────

function paymentStatus(
  paid: boolean, dueDay: number | null, month: number, year: number
): "paid" | "overdue" | "pending" {
  if (paid) return "paid";
  if (dueDay && isOverdue(dueDay, month, year)) return "overdue";
  return "pending";
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function GastosMensaisPage() {
  const { month: cm, year: cy } = getCurrentMonth();
  const [month, setMonth] = useState(cm);
  const [year, setYear]   = useState(cy);
  const [loading, setLoading] = useState(true);

  // ── Dados ──────────────────────────────────────────────────────────────────
  const [fixedBills,    setFixedBills]    = useState<FixedBill[]>([]);
  const [billPayments,  setBillPayments]  = useState<MonthlyBillPayment[]>([]);
  const [creditCards,   setCreditCards]   = useState<CCType[]>([]);
  const [cardPayments,  setCardPayments]  = useState<MonthlyCardPayment[]>([]);
  const [cardTotals,       setCardTotals]       = useState<Record<string, number>>({});
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([]);
  const [incomeSources,    setIncomeSources]    = useState<IncomeSource[]>([]);
  const [monthlyIncomes,   setMonthlyIncomes]   = useState<MonthlyIncome[]>([]);
  const [sourceAmounts,    setSourceAmounts]    = useState<IncomeSourceAmount[]>([]);
  const [expandedCard,     setExpandedCard]     = useState<string | null>(null);
  const [prevBalance,      setPrevBalance]      = useState(0);

  // ── Config do saldo acumulado (localStorage) ───────────────────────────────
  const [accConfig,     setAccConfig]     = useState<AccumuladoConfig>(() => getAccConfig());
  const [accModal,      setAccModal]      = useState(false);
  const [editAccConfig, setEditAccConfig] = useState<AccumuladoConfig>(() => getAccConfig());

  // ── Override de saldo ──────────────────────────────────────────────────────
  const [balanceOverride, setBalanceOverride] = useState<MonthlyBalanceOverride | null>(null);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideForm, setOverrideForm] = useState<OverrideForm>({ autoZero: false, amount: "0", notes: "" });

  // ── Adiantamentos ────────────────────────────────────────────────────────
  const [advancesMadeThisMonth, setAdvancesMadeThisMonth] = useState<BillAdvance[]>([]);
  const [advancesForThisMonth,  setAdvancesForThisMonth]  = useState<BillAdvance[]>([]);
  const [advanceModal, setAdvanceModal] = useState<AdvanceTarget | null>(null);

  // ── View mode ────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"cards" | "planilha">("cards");

  const { toast } = useToast();

  // ── Modal de edição de valor ───────────────────────────────────────────────
  const [editModal, setEditModal] = useState<EditBillAmountTarget | null>(null);

  useEffect(() => { loadAll(); }, [month, year, accConfig]);

  async function loadAll() {
    setLoading(true);
    try {
      clearBalanceCache();
      const [
        bills, payments, cards, cardPays, txs, sources, incomes, override,
        advMade, advFor, srcAmts,
      ] = await Promise.all([
        getFixedBills(),
        getMonthlyBillPayments(month, year),
        getCreditCards(),
        getMonthlyCardPayments(month, year),
        getCardTransactions(month, year),
        getIncomeSources(month, year),
        getMonthlyIncomes(month, year),
        getBalanceOverride(month, year),
        getBillAdvancesMadeIn(month, year),
        getBillAdvancesForMonth(month, year),
        getIncomeSourceAmounts(),
      ]);
      setSourceAmounts(srcAmts);
      setBalanceOverride(override);
      setAdvancesMadeThisMonth(advMade);
      setAdvancesForThisMonth(advFor);

      setFixedBills(bills);
      setBillPayments(payments);
      setCreditCards(cards);
      setCardPayments(cardPays);
      setIncomeSources(sources);
      setMonthlyIncomes(incomes);
      setCardTransactions(txs);

      const totals: Record<string, number> = {};
      cards.forEach(c => {
        totals[c.id] = txs
          .filter(t => t.card_id === c.id)
          .reduce((s, t) => s - t.amount, 0); // despesas negativas → subtrai; créditos positivos → abate
      });
      setCardTotals(totals);

      // ── Saldo acumulado anterior — módulo centralizado (respeita overrides + carry-over + dízimo) ──
      const prev = await computePrevBalance(month, year, accConfig);
      setPrevBalance(prev);
    } finally {
      setLoading(false);
    }
  }

  // ── Valores derivados ──────────────────────────────────────────────────────

  const tithe       = calcTithe(incomeSources, monthlyIncomes, month, year, sourceAmounts);
  const titheBill   = fixedBills.find(b => b.is_tithe);
  const regularBills = fixedBills.filter(b => !b.is_tithe);

  // Filtra contas fora do período de parcelas (antes do início ou após o fim)
  const visibleRegularBills = regularBills.filter(bill => {
    if (!bill.installment_total) return true; // sem parcelamento → sempre visível
    if (bill.installment_start_month == null || bill.installment_start_year == null) return true; // sem data → fallback visível
    return computeInstallment(bill, month, year) !== null;
  });

  const incomeTotal = incomeSources.reduce((s, src) => {
    const mi = monthlyIncomes.find(i => i.source_id === src.id);
    return s + (mi?.amount ?? resolveSourceAmount(src, month, year, sourceAmounts));
  }, 0);

  // Receita dividida por quinzena (baseada no due_day da fonte de renda)
  const q1Income = incomeSources.reduce((s, src) => {
    if ((src.due_day ?? 99) > 15) return s;
    const mi = monthlyIncomes.find(i => i.source_id === src.id);
    return s + (mi?.amount ?? resolveSourceAmount(src, month, year, sourceAmounts));
  }, 0);
  const q2Income = incomeTotal - q1Income;

  // IDs de contas que já foram pagas antecipadamente em um mês anterior
  const advancedBillIds = new Set(advancesForThisMonth.map(a => a.bill_id));

  /** Valor efetivo da conta no mês (payment sobrescreve a base) */
  function billAmount(bill: FixedBill): number {
    const p = billPayments.find(p => p.bill_id === bill.id);
    return p?.amount ?? (bill.is_tithe ? tithe.total : bill.amount);
  }

  /** Valor que entra no cálculo de saldo — 0 se a conta foi adiantada em mês anterior */
  function billEffectiveAmount(bill: FixedBill): number {
    if (advancedBillIds.has(bill.id)) return 0;
    return billAmount(bill);
  }

  function billSt(bill: FixedBill) {
    const p = billPayments.find(p => p.bill_id === bill.id);
    return paymentStatus(p?.paid ?? false, bill.due_day, month, year);
  }

  function cardSt(card: CCType) {
    const p = cardPayments.find(p => p.card_id === card.id);
    return paymentStatus(p?.paid ?? false, card.due_day, month, year);
  }

  // Separação por quinzena (usando apenas contas no range de parcelas ativo)
  // Pré-ordenadas por dia de vencimento para exibição correta
  const sortByDue = <T extends { due_day?: number | null }>(arr: T[]) =>
    [...arr].sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99));

  const q1Bills = sortByDue(visibleRegularBills.filter(b => b.period === "1-15"));
  const q2Bills = sortByDue(visibleRegularBills.filter(b => b.period === "16-30"));
  const q1Cards = sortByDue(creditCards.filter(c => c.due_day <= 15));
  const q2Cards = sortByDue(creditCards.filter(c => c.due_day > 15));

  const tithePayment      = titheBill ? billPayments.find(p => p.bill_id === titheBill.id) : undefined;
  const titheDisplayAmt   = tithePayment?.amount ?? tithe.total;
  const tithePeriod       = titheBill?.period ?? "16-30";

  const q1BillsSum = q1Bills.reduce((s, b) => s + billEffectiveAmount(b), 0);
  const q2BillsSum = q2Bills.reduce((s, b) => s + billEffectiveAmount(b), 0);
  const q1CardsSum = q1Cards.reduce((s, c) => s + (cardTotals[c.id] ?? 0), 0);
  const q2CardsSum = q2Cards.reduce((s, c) => s + (cardTotals[c.id] ?? 0), 0);

  // Adiantamentos feitos neste mês (soma por período da conta adiantada)
  const q1AdvancesSum = advancesMadeThisMonth
    .filter(a => fixedBills.find(b => b.id === a.bill_id)?.period === "1-15")
    .reduce((s, a) => s + a.amount, 0);
  const q2AdvancesSum = advancesMadeThisMonth
    .filter(a => (fixedBills.find(b => b.id === a.bill_id)?.period ?? "16-30") !== "1-15")
    .reduce((s, a) => s + a.amount, 0);

  // Só adiciona dízimo separado se o bill de dízimo existe (is_tithe=true)
  // Sem titheBill, a conta de dízimo já está em q1/q2BillsSum como regular
  const q1Total = q1BillsSum + q1CardsSum + q1AdvancesSum + (titheBill && tithePeriod === "1-15"  ? titheDisplayAmt : 0);
  const q2Total = q2BillsSum + q2CardsSum + q2AdvancesSum + (titheBill && tithePeriod === "16-30" ? titheDisplayAmt : 0);
  const balance = incomeTotal - q1Total - q2Total;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function saveAccConfigModal() {
    saveAccConfig(editAccConfig);
    setAccConfig(editAccConfig);
    setAccModal(false);
  }

  function openOverrideModal() {
    setOverrideForm({
      autoZero: balanceOverride?.auto_zero ?? false,
      amount: String(balanceOverride?.override_amount ?? 0),
      notes: balanceOverride?.notes ?? "",
    });
    setOverrideModal(true);
  }

  async function saveOverride() {
    try {
      await upsertBalanceOverride({
        month, year,
        auto_zero: overrideForm.autoZero,
        override_amount: overrideForm.autoZero ? 0 : Number(overrideForm.amount),
        notes: overrideForm.notes || null,
      });
      setOverrideModal(false);
      toast("Saldo ajustado com sucesso");
      await loadAll();
    } catch {
      toast("Erro ao salvar ajuste", "error");
    }
  }

  async function removeOverride() {
    try {
      await deleteBalanceOverride(month, year);
      setOverrideModal(false);
      toast("Ajuste removido — saldo calculado automaticamente");
      await loadAll();
    } catch {
      toast("Erro ao remover ajuste", "error");
    }
  }

  async function handleToggleBill(bill: FixedBill, paid: boolean) {
    await toggleBillPaid(bill.id, month, year, paid, billAmount(bill));
    await loadAll();
  }

  async function handleToggleCard(card: CCType, paid: boolean) {
    await toggleCardPaid(card.id, month, year, paid, cardTotals[card.id] ?? 0);
    await loadAll();
  }

  function openEdit(bill: FixedBill) {
    const p = billPayments.find(p => p.bill_id === bill.id);
    setEditModal({ bill, amount: String(billAmount(bill)), notes: p?.notes ?? "" });
  }

  function openAdvanceModal(bill: FixedBill) {
    // Sugere o próximo mês como alvo padrão
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    setAdvanceModal({ bill, targetMonth: nextMonth, targetYear: nextYear, amount: String(billAmount(bill)), notes: "" });
  }

  async function saveAdvance() {
    if (!advanceModal) return;
    try {
      await createBillAdvance(
        advanceModal.bill.id,
        advanceModal.targetMonth,
        advanceModal.targetYear,
        month, year,
        Number(advanceModal.amount),
        advanceModal.notes || undefined,
      );
      setAdvanceModal(null);
      toast(`Adiantamento registrado — ${advanceModal.bill.name} pré-pago para ${MONTHS[advanceModal.targetMonth - 1]}/${advanceModal.targetYear}`);
      await loadAll();
    } catch {
      toast("Erro ao registrar adiantamento", "error");
    }
  }

  async function removeAdvance(id: string) {
    try {
      await deleteBillAdvance(id);
      toast("Adiantamento removido");
      await loadAll();
    } catch {
      toast("Erro ao remover adiantamento", "error");
    }
  }

  async function saveEdit() {
    if (!editModal) return;
    await updateBillPaymentAmount(
      editModal.bill.id, month, year,
      Number(editModal.amount), editModal.notes
    );
    setEditModal(null);
    await loadAll();
  }

  // ── Render principal ───────────────────────────────────────────────────────

  return (
    <div className="p-3 md:p-6 min-h-screen">
      <PageHeader title="Gastos Mensais" subtitle="Controle de pagamentos por quinzena">
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-700/60 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode("cards")}
              className={`px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                viewMode === "cards"
                  ? "bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400"
              }`}
              title="Visualização em cards"
            ><LayoutGrid size={12} /> Cards</button>
            <button
              onClick={() => setViewMode("planilha")}
              className={`px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                viewMode === "planilha"
                  ? "bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400"
              }`}
              title="Visualização tipo planilha"
            ><LayoutList size={12} /> Planilha</button>
          </div>
          <button
            onClick={async () => {
              const { exportMonth } = await import("@/lib/exportExcel");
              await exportMonth(month, year);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            title="Exportar mês para Excel"
          >
            <Download size={13} /> Excel
          </button>
          <MonthSelector month={month} year={year}
            onChange={(m, y) => { setMonth(m); setYear(y); }} />
        </div>
      </PageHeader>

      <FluxoCaixa
        prevBalance={prevBalance}
        balance={balance}
        balanceOverride={balanceOverride}
        q1Income={q1Income}
        q1Total={q1Total}
        q2Income={q2Income}
        q2Total={q2Total}
        month={month}
        year={year}
        onOpenAccConfig={() => { setEditAccConfig({ ...accConfig }); setAccModal(true); }}
        onAdjustBalance={openOverrideModal}
      />

      {viewMode === "cards" ? (
        <>
          {/* Dízimo */}
          <TitheSection
            titheBill={titheBill}
            billSt={billSt}
            incomeTotal={incomeTotal}
            titheDisplayAmt={titheDisplayAmt}
            tithePayment={tithePayment}
            tithe={tithe}
            onEdit={openEdit}
            onToggle={handleToggleBill}
          />

          {/* Quinzenas */}
          <div className="space-y-6">
            <QuinzenaSection
              label="1ª Quinzena" subtitle="dias 1 a 15"
              bills={q1Bills} cards={q1Cards} totalQ={q1Total}
              fixedBills={fixedBills}
              billPayments={billPayments}
              billAmount={billAmount}
              billEffectiveAmount={billEffectiveAmount}
              billSt={billSt}
              advancedBillIds={advancedBillIds}
              advancesForThisMonth={advancesForThisMonth}
              advancesMadeThisMonth={advancesMadeThisMonth}
              cardTotals={cardTotals}
              cardPayments={cardPayments}
              cardSt={cardSt}
              cardTransactions={cardTransactions}
              expandedCard={expandedCard}
              onExpandCard={setExpandedCard}
              month={month}
              year={year}
              incomeTotal={incomeTotal}
              onToggleBill={handleToggleBill}
              onToggleCard={handleToggleCard}
              onAdvanceBill={openAdvanceModal}
              onEditBill={openEdit}
              onRemoveAdvance={removeAdvance}
            />
            <QuinzenaSection
              label="2ª Quinzena" subtitle="dias 16 a 30"
              bills={q2Bills} cards={q2Cards} totalQ={q2Total}
              fixedBills={fixedBills}
              billPayments={billPayments}
              billAmount={billAmount}
              billEffectiveAmount={billEffectiveAmount}
              billSt={billSt}
              advancedBillIds={advancedBillIds}
              advancesForThisMonth={advancesForThisMonth}
              advancesMadeThisMonth={advancesMadeThisMonth}
              cardTotals={cardTotals}
              cardPayments={cardPayments}
              cardSt={cardSt}
              cardTransactions={cardTransactions}
              expandedCard={expandedCard}
              onExpandCard={setExpandedCard}
              month={month}
              year={year}
              incomeTotal={incomeTotal}
              onToggleBill={handleToggleBill}
              onToggleCard={handleToggleCard}
              onAdvanceBill={openAdvanceModal}
              onEditBill={openEdit}
              onRemoveAdvance={removeAdvance}
            />
          </div>
        </>
      ) : (
        <SpreadsheetView
          prevBalance={prevBalance}
          balance={balance}
          balanceOverride={balanceOverride}
          q1Income={q1Income}
          q1Total={q1Total}
          q2Income={q2Income}
          q2Total={q2Total}
          q1Bills={q1Bills}
          q1Cards={q1Cards}
          q2Bills={q2Bills}
          q2Cards={q2Cards}
          month={month}
          year={year}
          billAmount={billAmount}
          billPayments={billPayments}
          cardTotals={cardTotals}
          cardPayments={cardPayments}
          incomeSources={incomeSources}
          monthlyIncomes={monthlyIncomes}
          sourceAmounts={sourceAmounts}
          incomeTotal={incomeTotal}
          titheBill={titheBill}
          tithePayment={tithePayment}
          titheDisplayAmt={titheDisplayAmt}
          onToggleBill={handleToggleBill}
          onToggleCard={handleToggleCard}
          onAdjustBalance={openOverrideModal}
        />
      )}

      <BalanceOverrideModal
        open={overrideModal}
        onClose={() => setOverrideModal(false)}
        form={overrideForm}
        onFormChange={(patch) => setOverrideForm(p => ({ ...p, ...patch }))}
        hasExisting={!!balanceOverride}
        calculatedBalance={prevBalance + balance}
        onSave={saveOverride}
        onRemove={removeOverride}
      />

      <AccConfigModal
        open={accModal}
        onClose={() => setAccModal(false)}
        value={editAccConfig}
        onChange={(patch) => setEditAccConfig(p => ({ ...p, ...patch }))}
        onSave={saveAccConfigModal}
      />

      <EditBillAmountModal
        target={editModal}
        onClose={() => setEditModal(null)}
        onChange={(patch) => setEditModal(p => p && ({ ...p, ...patch }))}
        titheTotal={tithe.total}
        incomeTotal={incomeTotal}
        onSave={saveEdit}
      />

      <AdvancePaymentModal
        target={advanceModal}
        onClose={() => setAdvanceModal(null)}
        onChange={(patch) => setAdvanceModal(p => p && ({ ...p, ...patch }))}
        month={month}
        year={year}
        onSave={saveAdvance}
      />
    </div>
  );
}
