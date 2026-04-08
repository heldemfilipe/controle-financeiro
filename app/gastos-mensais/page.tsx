"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, CreditCard, FileText, Pencil, ChevronDown, ChevronRight, Settings, Download, Sliders, LayoutList, LayoutGrid, ChevronsRight, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  getFixedBills, getMonthlyBillPayments, toggleBillPaid, updateBillPaymentAmount,
  getCreditCards, getCardTransactions, getMonthlyCardPayments, toggleCardPaid,
  getMonthlyIncomes, getIncomeSources,
  getBalanceOverride, upsertBalanceOverride, deleteBalanceOverride,
  getBillAdvancesMadeIn, getBillAdvancesForMonth, createBillAdvance, deleteBillAdvance,
} from "@/lib/queries";
import { formatCurrency, getCurrentMonth, getMonthName, isOverdue, isDueSoon, getDueInfo, computeInstallment, getAccConfig, saveAccConfig } from "@/lib/utils";
import type { DueInfo } from "@/lib/utils";
import type { AccumuladoConfig } from "@/lib/utils";
import { computePrevBalance, clearBalanceCache } from "@/lib/balance";
import { MONTHS } from "@/types";
import type {
  FixedBill, CreditCard as CCType, MonthlyBillPayment,
  MonthlyCardPayment, IncomeSource, MonthlyIncome, CardTransaction, MonthlyBalanceOverride, BillAdvance,
} from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers puros (sem hooks — podem ficar fora do componente)
// ─────────────────────────────────────────────────────────────────────────────

/** Calcula 10% da renda agrupado dinamicamente por owner (sem nomes fixos) */
function calcTithe(sources: IncomeSource[], incomes: MonthlyIncome[]) {
  const owners = Array.from(new Set(sources.map(s => s.owner)));
  const byOwner: Record<string, { base: number; tithe: number }> = {};

  owners.forEach(owner => {
    const base = sources
      .filter(s => s.owner === owner)
      .reduce((acc, s) => acc + (incomes.find(i => i.source_id === s.id)?.amount ?? s.base_amount), 0);
    byOwner[owner] = { base, tithe: base * 0.1 };
  });

  const total = Object.values(byOwner).reduce((s, v) => s + v.base, 0) * 0.1;
  return { byOwner, total };
}

function paymentStatus(
  paid: boolean, dueDay: number | null, month: number, year: number
): "paid" | "overdue" | "pending" {
  if (paid) return "paid";
  if (dueDay && isOverdue(dueDay, month, year)) return "overdue";
  return "pending";
}

function StatusIcon({ status }: { status: "paid" | "overdue" | "pending" }) {
  if (status === "paid")   return <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />;
  if (status === "overdue") return <AlertTriangle size={15} className="text-red-500 shrink-0" />;
  return <Clock size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />;
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
  const [expandedCard,     setExpandedCard]     = useState<string | null>(null);
  const [prevBalance,      setPrevBalance]      = useState(0);

  // ── Config do saldo acumulado (localStorage) ───────────────────────────────
  const [accConfig,     setAccConfig]     = useState<AccumuladoConfig>(() => getAccConfig());
  const [accModal,      setAccModal]      = useState(false);
  const [editAccConfig, setEditAccConfig] = useState<AccumuladoConfig>(() => getAccConfig());

  // ── Override de saldo ──────────────────────────────────────────────────────
  const [balanceOverride, setBalanceOverride] = useState<MonthlyBalanceOverride | null>(null);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ autoZero: false, amount: "0", notes: "" });

  // ── Adiantamentos ────────────────────────────────────────────────────────
  const [advancesMadeThisMonth, setAdvancesMadeThisMonth] = useState<BillAdvance[]>([]);
  const [advancesForThisMonth,  setAdvancesForThisMonth]  = useState<BillAdvance[]>([]);
  const [advanceModal, setAdvanceModal] = useState<{
    bill: FixedBill;
    targetMonth: number;
    targetYear: number;
    amount: string;
    notes: string;
  } | null>(null);

  // ── View mode ────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"cards" | "planilha">("cards");

  const { toast } = useToast();

  // ── Modal de edição de valor ───────────────────────────────────────────────
  const [editModal, setEditModal] = useState<{
    bill: FixedBill; amount: string; notes: string;
  } | null>(null);

  useEffect(() => { loadAll(); }, [month, year, accConfig]);

  async function loadAll() {
    setLoading(true);
    try {
      clearBalanceCache();
      const [
        bills, payments, cards, cardPays, txs, sources, incomes, override,
        advMade, advFor,
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
      ]);
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

  const tithe       = calcTithe(incomeSources, monthlyIncomes);
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
    return s + (mi?.amount ?? src.base_amount);
  }, 0);

  // Receita dividida por quinzena (baseada no due_day da fonte de renda)
  const q1Income = incomeSources.reduce((s, src) => {
    if ((src.due_day ?? 99) > 15) return s;
    const mi = monthlyIncomes.find(i => i.source_id === src.id);
    return s + (mi?.amount ?? src.base_amount);
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

  // ── Render: linha de conta ─────────────────────────────────────────────────

  function BillRow({ bill }: { bill: FixedBill }) {
    const advance  = advancesForThisMonth.find(a => a.bill_id === bill.id);
    const isAdvanced = !!advance;

    const status  = isAdvanced ? "paid" : billSt(bill);
    const amount  = billAmount(bill);
    const payment = billPayments.find(p => p.bill_id === bill.id);
    const dueInfo: DueInfo | null = (status === "pending" && !isAdvanced) ? getDueInfo(bill.due_day, month, year) : null;

    const isUrgent = dueInfo && (dueInfo.urgency === "today" || dueInfo.urgency === "tomorrow" || dueInfo.urgency === "soon");

    // Cor do card conforme situação de vencimento
    const rowBg = isAdvanced
      ? "bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/30"
      : status === "overdue"
        ? "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40"
        : isUrgent
        ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40"
        : "bg-white dark:bg-slate-800";

    const dueTextColor =
      status === "overdue"                           ? "text-red-500 dark:text-red-400" :
      dueInfo?.urgency === "today"                   ? "text-red-500 dark:text-red-400" :
      dueInfo?.urgency === "tomorrow"                ? "text-amber-600 dark:text-amber-400" :
      dueInfo?.urgency === "soon"                    ? "text-amber-600 dark:text-amber-400" :
      dueInfo?.urgency === "later"                   ? "text-slate-500 dark:text-slate-400" :
                                                       "text-slate-400 dark:text-slate-500";

    return (
      <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 shadow-sm gap-2 ${rowBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon status={status} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{bill.name}</p>
              {isAdvanced && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-medium shrink-0">
                  Adiantado
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {isAdvanced ? (
                <span className="text-xs text-violet-500 dark:text-violet-400">
                  Pago em {MONTHS[advance.paid_month - 1]}/{advance.paid_year}
                </span>
              ) : (
                <>
                  {bill.due_day && (
                    <span className={`text-xs ${dueTextColor}`}>
                      dia {bill.due_day}
                      {dueInfo && ` · ${dueInfo.label}`}
                    </span>
                  )}
                  {(() => {
                    const inst = computeInstallment(bill, month, year);
                    return inst ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        · {inst.current}/{inst.total}x
                      </span>
                    ) : null;
                  })()}
                  {payment?.notes && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 italic truncate max-w-[100px]">
                      {payment.notes}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className={`text-sm font-semibold ${isAdvanced ? "text-violet-500 dark:text-violet-400 line-through" : "text-red-600 dark:text-red-400"}`}>
                -{formatCurrency(amount)}
              </span>
              {!isAdvanced && (
                <>
                  <button
                    onClick={() => openAdvanceModal(bill)}
                    title="Adiantar pagamento para próximo mês"
                    className="p-0.5 hover:bg-violet-100 dark:hover:bg-violet-800/40 rounded transition-colors"
                  >
                    <ChevronsRight size={10} className="text-violet-400 dark:text-violet-500" />
                  </button>
                  <button
                    onClick={() => openEdit(bill)}
                    title="Editar valor deste mês"
                    className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    <Pencil size={10} className="text-slate-400 dark:text-slate-500" />
                  </button>
                </>
              )}
            </div>
            {status === "overdue" && !payment?.paid && !isAdvanced && dueInfo && (
              <span className="text-xs text-red-500 font-medium">{dueInfo.label}</span>
            )}
            {status === "overdue" && !payment?.paid && !isAdvanced && !dueInfo && (
              <span className="text-xs text-red-500 font-medium">Vencida!</span>
            )}
          </div>
          <Toggle
            checked={isAdvanced || (payment?.paid ?? false)}
            onChange={v => !isAdvanced && handleToggleBill(bill, v)}
            disabled={isAdvanced}
          />
        </div>
      </div>
    );
  }

  // ── Render: linha de cartão ────────────────────────────────────────────────

  function CardRow({ card }: { card: CCType }) {
    const total    = cardTotals[card.id] ?? 0;
    const status   = cardSt(card);
    const payment  = cardPayments.find(p => p.card_id === card.id);
    const txs      = cardTransactions.filter(t => t.card_id === card.id);
    const isOpen   = expandedCard === card.id;
    const dueInfo: DueInfo | null = status === "pending" && total > 0 ? getDueInfo(card.due_day, month, year) : null;
    const isUrgent = dueInfo && (dueInfo.urgency === "today" || dueInfo.urgency === "tomorrow" || dueInfo.urgency === "soon");
    const parcelCount = txs.filter(t => t.installment_total > 1).length;

    const cardBg = total > 0 && status === "overdue"
      ? "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40"
      : total > 0 && isUrgent
        ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40"
        : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50";

    const dayBadge = total > 0 && status === "overdue"
      ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
      : total > 0 && dueInfo?.urgency === "today"
        ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
      : total > 0 && isUrgent
        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400";

    const barColor = total > 0 && status === "overdue" ? "#ef4444"
      : total > 0 && dueInfo?.urgency === "today"   ? "#ef4444"
      : total > 0 && isUrgent                       ? "#f59e0b"
      : card.color;

    return (
      <div className={`rounded-xl shadow-sm overflow-hidden ${cardBg}`}>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              onClick={() => setExpandedCard(isOpen ? null : card.id)}
            >
              <div
                className="w-8 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${card.color}bb, ${card.color})` }}
              >
                <CreditCard size={11} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{card.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400 dark:text-slate-500 capitalize">{card.owner}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${dayBadge}`}>
                    Dia {card.due_day}
                  </span>
                  {dueInfo && (
                    <span className={`text-xs font-medium ${
                      dueInfo.urgency === "overdue" || dueInfo.urgency === "today"
                        ? "text-red-500 dark:text-red-400"
                        : dueInfo.urgency === "later"
                        ? "text-slate-400 dark:text-slate-500"
                        : "text-amber-600 dark:text-amber-400"
                    }`}>
                      · {dueInfo.label}
                    </span>
                  )}
                  {txs.length > 0 && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {txs.length} lanç.{parcelCount > 0 && ` · ${parcelCount} parc.`}
                    </span>
                  )}
                </div>
              </div>
              {txs.length > 0 && (
                isOpen
                  ? <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
                  : <ChevronRight size={14} className="text-slate-400 shrink-0 ml-1" />
              )}
            </button>

            <div className="flex items-center gap-2.5 shrink-0 ml-2">
              <div className="text-right">
                <p className={`text-sm font-bold ${total > 0 ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-600"}`}>
                  {formatCurrency(total)}
                </p>
                {status === "paid" ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Pago</p>
                ) : status === "overdue" && total > 0 ? (
                  <p className="text-xs text-red-500 dark:text-red-400 font-medium">
                    {dueInfo ? dueInfo.label : "Vencida!"}
                  </p>
                ) : dueInfo ? (
                  <p className={`text-xs font-medium ${
                    dueInfo.urgency === "today"
                      ? "text-red-500 dark:text-red-400"
                      : dueInfo.urgency === "later"
                      ? "text-slate-400 dark:text-slate-500"
                      : "text-amber-600 dark:text-amber-400"
                  }`}>
                    {dueInfo.label}
                  </p>
                ) : total > 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">Pendente</p>
                ) : null}
              </div>
              <Toggle checked={payment?.paid ?? false} onChange={v => handleToggleCard(card, v)} disabled={total === 0} />
            </div>
          </div>

          {total > 0 && incomeTotal > 0 && (
            <div className="mt-2">
              <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-1 rounded-full transition-all"
                  style={{ width: `${Math.min((total / incomeTotal) * 100, 100)}%`, backgroundColor: barColor }} />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {((total / incomeTotal) * 100).toFixed(1)}% da renda
              </p>
            </div>
          )}
        </div>

        {isOpen && (
          <div className="border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 space-y-1.5">
            {txs.length === 0 ? (
              <p className="text-xs text-slate-400 py-1 text-center">Nenhum lançamento neste mês</p>
            ) : txs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between gap-2 py-0.5">
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate block">{tx.description}</span>
                  {tx.installment_total > 1 && (
                    <span className="text-xs text-violet-500 font-medium">{tx.installment_current}/{tx.installment_total}x</span>
                  )}
                </div>
                <span className={`text-xs font-semibold shrink-0 ${tx.amount > 0 ? "text-emerald-500" : "text-slate-600 dark:text-slate-300"}`}>
                  {tx.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render: seção de quinzena ──────────────────────────────────────────────

  function QuinzenaSection({
    label, subtitle, bills, cards, totalQ,
  }: {
    label: string; subtitle: string;
    bills: FixedBill[]; cards: CCType[]; totalQ: number;
  }) {
    const isQ1     = label.startsWith("1");
    const accent   = isQ1 ? "primary" : "amber";
    const period   = isQ1 ? "1-15" : "16-30";
    const billsSum = bills.reduce((s, b) => s + billEffectiveAmount(b), 0);
    // Adiantamentos feitos neste mês para este período
    const periodAdvances = advancesMadeThisMonth.filter(
      adv => (fixedBills.find(b => b.id === adv.bill_id)?.period ?? "16-30") === period
    );
    const cardsSum = cards.reduce((s, c) => s + (cardTotals[c.id] ?? 0), 0);

    // Agrupamento dinâmico por categoria (suporta categorias customizadas)
    // Ordena os grupos pela menor due_day de qualquer conta naquele grupo
    const catGroups = Array.from(new Set(bills.map(b => b.category || "outros")))
      .sort((a, b) => {
        const minA = Math.min(...bills.filter(x => (x.category || "outros") === a).map(x => x.due_day ?? 99));
        const minB = Math.min(...bills.filter(x => (x.category || "outros") === b).map(x => x.due_day ?? 99));
        return minA - minB;
      });
    // Ordena cartões por due_day dentro da quinzena
    const sortedCards = [...cards].sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99));

    return (
      <div>
        {/* Cabeçalho da quinzena */}
        <div className={`flex items-center justify-between border-b-2 pb-2.5 mb-4
          border-${accent}-200 dark:border-${accent}-800/40`}>
          <div>
            <h2 className={`text-base font-bold text-${accent}-700 dark:text-${accent}-400`}>
              {label}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-lg
            bg-${accent}-50 dark:bg-${accent}-900/20
            text-${accent}-700 dark:text-${accent}-400`}>
            {formatCurrency(totalQ)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Contas */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <FileText size={12} />
              Contas — {formatCurrency(billsSum)}
            </h3>

            {bills.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                Nenhuma conta neste período
              </p>
            ) : (
              <div className="space-y-3">
                {catGroups.map(cat => {
                  const catBills = bills
                    .filter(b => (b.category || "outros") === cat)
                    .sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99));
                  if (catBills.length === 0) return null;
                  const isEssencial = cat === "essencial";
                  return (
                    <div key={cat}>
                      <p className={`text-xs font-medium mb-1.5 ${
                        isEssencial
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </p>
                      <div className="space-y-1.5">
                        {catBills.map(b => <BillRow key={b.id} bill={b} />)}
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const advancedInThis = bills.filter(b => advancedBillIds.has(b.id));
                  const paidNormally   = bills.filter(b => !advancedBillIds.has(b.id) && billPayments.find(p => p.bill_id === b.id)?.paid);
                  const paidSum        = paidNormally.reduce((s, b) => s + billAmount(b), 0);
                  const advancedSum    = advancedInThis.reduce((s, b) => s + billAmount(b), 0);
                  const remaining      = billsSum - paidSum;
                  const totalPaid      = paidNormally.length + advancedInThis.length;
                  return (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {totalPaid}/{bills.length} pagas
                        </span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {formatCurrency(billsSum)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ✓ Pago {formatCurrency(paidSum)}
                          {advancedSum > 0 && <span className="text-violet-500 ml-1">+ Adiantado {formatCurrency(advancedSum)}</span>}
                        </span>
                        <span className={remaining > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                          {remaining > 0 ? `Falta ${formatCurrency(remaining)}` : "Tudo pago ✓"}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Adiantamentos feitos neste mês para meses futuros */}
                {periodAdvances.length > 0 && (
                  <div className="pt-2 border-t border-violet-200 dark:border-violet-800/30">
                    <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      <ChevronsRight size={12} />
                      Adiantamentos — {formatCurrency(periodAdvances.reduce((s, a) => s + a.amount, 0))}
                    </p>
                    <div className="space-y-1.5">
                      {periodAdvances.map(adv => {
                        const bill = fixedBills.find(b => b.id === adv.bill_id);
                        return (
                          <div key={adv.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/30">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-violet-700 dark:text-violet-300 truncate">
                                {bill?.name ?? "Conta"}
                              </p>
                              <p className="text-xs text-violet-500 dark:text-violet-400">
                                Para {MONTHS[adv.target_month - 1]}/{adv.target_year}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                                -{formatCurrency(adv.amount)}
                              </span>
                              <button
                                onClick={() => removeAdvance(adv.id)}
                                title="Remover adiantamento"
                                className="p-0.5 hover:bg-violet-100 dark:hover:bg-violet-800/40 rounded transition-colors"
                              >
                                <X size={11} className="text-violet-400" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cartões */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <CreditCard size={12} />
              Cartões — {formatCurrency(cardsSum)}
            </h3>

            {cards.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                Nenhum cartão neste período
              </p>
            ) : (
              <div className="space-y-2">
                {sortedCards.map(c => <CardRow key={c.id} card={c} />)}
                {(() => {
                  const cardsWithValue = cards.filter(c => (cardTotals[c.id] ?? 0) > 0);
                  const paidCards  = cardsWithValue.filter(c => cardPayments.find(p => p.card_id === c.id)?.paid);
                  const paidSum    = paidCards.reduce((s, c) => s + (cardTotals[c.id] ?? 0), 0);
                  const remaining  = cardsSum - paidSum;
                  return (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {paidCards.length}/{cardsWithValue.length} pagas
                        </span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {formatCurrency(cardsSum)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ✓ Pago {formatCurrency(paidSum)}
                        </span>
                        <span className={remaining > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                          {remaining > 0 ? `Falta ${formatCurrency(remaining)}` : "Tudo pago ✓"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: seção do dízimo ────────────────────────────────────────────────

  function TitheSection() {
    if (!titheBill) return null;

    const status = billSt(titheBill);

    return (
      <div className="mb-6 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800/30 rounded-xl p-4 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <StatusIcon status={status} />
            <div>
              <h2 className="text-sm font-bold text-violet-800 dark:text-violet-300">
                Dízimo — 10% da Renda
              </h2>
              <p className="text-xs text-violet-600 dark:text-violet-400">
                10% sobre {formatCurrency(incomeTotal)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                <span className="text-base font-bold text-violet-800 dark:text-violet-200">
                  {formatCurrency(titheDisplayAmt)}
                </span>
                <button
                  onClick={() => openEdit(titheBill)}
                  title="Editar valor do dízimo"
                  className="p-1 hover:bg-violet-100 dark:hover:bg-violet-800/40 rounded transition-colors"
                >
                  <Pencil size={11} className="text-violet-500" />
                </button>
              </div>
              {tithePayment?.paid && (
                <p className="text-xs text-emerald-600">✓ Pago</p>
              )}
            </div>
            <Toggle
              checked={tithePayment?.paid ?? false}
              onChange={v => handleToggleBill(titheBill, v)}
            />
          </div>
        </div>

        {/* Breakdown por owner (dinâmico) */}
        {(() => {
          const entries = Object.entries(tithe.byOwner).filter(([, v]) => v.base > 0);
          const cols = entries.length >= 3 ? "grid-cols-3" : entries.length === 2 ? "grid-cols-2" : "grid-cols-1";
          return (
            <div className={`grid gap-2 ${cols}`}>
              {entries.map(([owner, { base, tithe: ownerTithe }]) => (
                <div key={owner} className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-2.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 capitalize">{owner}</p>
                  <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
                    {formatCurrency(ownerTithe)}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    10% de {formatCurrency(base)}
                  </p>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Render: vista planilha ─────────────────────────────────────────────────

  function SpreadsheetView() {
    const accBalance = prevBalance + balance;
    const saldoMeio = prevBalance + q1Income - q1Total;

    const allItems: { name: string; amount: number; dueDay: number | null; paid: boolean; type: "bill" | "card"; installment?: string; id: string; period: string }[] = [];

    // Bills 1-15
    q1Bills.forEach(b => {
      const inst = computeInstallment(b, month, year);
      allItems.push({
        name: b.name, amount: billAmount(b), dueDay: b.due_day,
        paid: billPayments.find(p => p.bill_id === b.id)?.paid ?? false,
        type: "bill", installment: inst ? `${inst.current}/${inst.total}x` : undefined,
        id: b.id, period: "1-15",
      });
    });
    // Cards 1-15
    q1Cards.forEach(c => {
      const total = cardTotals[c.id] ?? 0;
      if (total > 0) {
        allItems.push({
          name: c.name, amount: total, dueDay: c.due_day,
          paid: cardPayments.find(p => p.card_id === c.id)?.paid ?? false,
          type: "card", id: c.id, period: "1-15",
        });
      }
    });
    // Bills 16-30
    q2Bills.forEach(b => {
      const inst = computeInstallment(b, month, year);
      allItems.push({
        name: b.name, amount: billAmount(b), dueDay: b.due_day,
        paid: billPayments.find(p => p.bill_id === b.id)?.paid ?? false,
        type: "bill", installment: inst ? `${inst.current}/${inst.total}x` : undefined,
        id: b.id, period: "16-30",
      });
    });
    // Cards 16-30
    q2Cards.forEach(c => {
      const total = cardTotals[c.id] ?? 0;
      if (total > 0) {
        allItems.push({
          name: c.name, amount: total, dueDay: c.due_day,
          paid: cardPayments.find(p => p.card_id === c.id)?.paid ?? false,
          type: "card", id: c.id, period: "16-30",
        });
      }
    });

    const q1Items = allItems.filter(i => i.period === "1-15");
    const q2Items = allItems.filter(i => i.period === "16-30");

    function SheetRow({ item, onToggle }: { item: typeof allItems[0]; onToggle: (paid: boolean) => void }) {
      const status = item.paid ? "paid" : item.dueDay && isOverdue(item.dueDay, month, year) ? "overdue" : "pending";
      return (
        <div className={`flex items-center gap-2 py-2 px-3 border-b border-slate-100 dark:border-slate-700/30 ${
          status === "overdue" ? "bg-red-50/50 dark:bg-red-900/10" :
          status === "paid" ? "bg-emerald-50/30 dark:bg-emerald-900/5" : ""
        }`}>
          <Toggle checked={item.paid} onChange={onToggle} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {item.type === "card" && <CreditCard size={11} className="text-slate-400 shrink-0" />}
              <span className={`text-sm truncate ${item.paid ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>
                {item.name}
              </span>
              {item.installment && (
                <span className="text-xs text-violet-500 font-medium shrink-0">{item.installment}</span>
              )}
            </div>
          </div>
          {item.dueDay && (
            <span className={`text-xs shrink-0 ${status === "overdue" ? "text-red-500 font-medium" : "text-slate-400"}`}>
              dia {item.dueDay}
            </span>
          )}
          <span className={`text-sm font-semibold shrink-0 tabular-nums ${item.paid ? "text-slate-400" : "text-red-600 dark:text-red-400"}`}>
            -{formatCurrency(item.amount)}
          </span>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl overflow-hidden mb-6">
        {/* Renda */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 border-b border-emerald-200 dark:border-emerald-800/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Receitas</span>
            <span className="text-sm font-bold text-emerald-600">{formatCurrency(incomeTotal)}</span>
          </div>
          {incomeSources.map(src => {
            const mi = monthlyIncomes.find(i => i.source_id === src.id);
            const amt = mi?.amount ?? src.base_amount;
            return (
              <div key={src.id} className="flex items-center justify-between py-1">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">{src.name}</span>
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 tabular-nums">+{formatCurrency(amt)}</span>
              </div>
            );
          })}
        </div>

        {/* Saldo anterior */}
        {prevBalance !== 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700/30">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Saldo mes anterior</span>
            <span className={`text-sm font-semibold tabular-nums ${prevBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {formatCurrency(prevBalance)}
            </span>
          </div>
        )}

        {/* Saldo dia 1 (receita 1ª quinzena + saldo anterior) */}
        <div className="flex items-center justify-between px-3 py-2 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800/30">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Saldo dia 1 (disponível)</span>
          <span className="text-sm font-bold text-blue-600 tabular-nums">{formatCurrency(prevBalance + q1Income)}</span>
        </div>

        {/* Contas 1-15 */}
        <div className="border-b-2 border-primary-200 dark:border-primary-800/40">
          <div className="flex items-center justify-between px-3 py-2 bg-primary-50 dark:bg-primary-900/20">
            <span className="text-xs font-bold text-primary-700 dark:text-primary-400 uppercase">Contas 1ª Quinzena (1-15)</span>
            <span className="text-sm font-bold text-primary-600">{formatCurrency(q1Total)}</span>
          </div>
          {q1Items.map(item => (
            <SheetRow key={item.id} item={item} onToggle={paid => {
              if (item.type === "bill") {
                const bill = q1Bills.find(b => b.id === item.id);
                if (bill) handleToggleBill(bill, paid);
              } else {
                const card = q1Cards.find(c => c.id === item.id);
                if (card) handleToggleCard(card, paid);
              }
            }} />
          ))}
          {titheBill && titheBill.period === "1-15" && (
            <div className="flex items-center gap-2 py-2 px-3 border-b border-slate-100 dark:border-slate-700/30 bg-violet-50/50 dark:bg-violet-900/10">
              <Toggle checked={tithePayment?.paid ?? false} onChange={v => handleToggleBill(titheBill, v)} />
              <span className="text-sm text-violet-700 dark:text-violet-300 flex-1">Dizimo (10%)</span>
              <span className="text-sm font-semibold text-violet-600 tabular-nums">-{formatCurrency(titheDisplayAmt)}</span>
            </div>
          )}
        </div>

        {/* Saldo dia 15 */}
        <div className={`flex items-center justify-between px-3 py-2.5 ${
          saldoMeio >= 0
            ? "bg-emerald-50/70 dark:bg-emerald-900/15 border-b border-emerald-200 dark:border-emerald-800/30"
            : "bg-red-50/70 dark:bg-red-900/15 border-b border-red-200 dark:border-red-800/30"
        }`}>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Saldo dia 15</span>
          <span className={`text-sm font-bold tabular-nums ${saldoMeio >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {formatCurrency(saldoMeio)}
          </span>
        </div>

        {/* Receitas 2ª quinzena (entre saldo dia 15 e contas 16-30) */}
        {q2Income > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800/30">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Receitas 2ª Quinzena</span>
            <span className="text-sm font-bold text-emerald-600 tabular-nums">+{formatCurrency(q2Income)}</span>
          </div>
        )}

        {/* Contas 16-30 */}
        <div className="border-b-2 border-amber-200 dark:border-amber-800/40">
          <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-900/20">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">Contas 2ª Quinzena (16-30)</span>
            <span className="text-sm font-bold text-amber-600">{formatCurrency(q2Total)}</span>
          </div>
          {q2Items.map(item => (
            <SheetRow key={item.id} item={item} onToggle={paid => {
              if (item.type === "bill") {
                const bill = q2Bills.find(b => b.id === item.id);
                if (bill) handleToggleBill(bill, paid);
              } else {
                const card = q2Cards.find(c => c.id === item.id);
                if (card) handleToggleCard(card, paid);
              }
            }} />
          ))}
          {titheBill && titheBill.period === "16-30" && (
            <div className="flex items-center gap-2 py-2 px-3 border-b border-slate-100 dark:border-slate-700/30 bg-violet-50/50 dark:bg-violet-900/10">
              <Toggle checked={tithePayment?.paid ?? false} onChange={v => handleToggleBill(titheBill, v)} />
              <span className="text-sm text-violet-700 dark:text-violet-300 flex-1">Dizimo (10%)</span>
              <span className="text-sm font-semibold text-violet-600 tabular-nums">-{formatCurrency(titheDisplayAmt)}</span>
            </div>
          )}
        </div>

        {/* Saldo final */}
        <div className={`flex items-center justify-between px-3 py-3 ${
          accBalance >= 0
            ? "bg-emerald-50 dark:bg-emerald-900/20"
            : "bg-red-50 dark:bg-red-900/20"
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Saldo Final</span>
            {balanceOverride && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 font-medium">
                {balanceOverride.auto_zero ? "Zerado" : "Ajustado"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-base font-bold tabular-nums ${accBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {formatCurrency(accBalance)}
            </span>
            <button onClick={openOverrideModal} title="Ajustar saldo" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors">
              <Sliders size={12} className="text-violet-500" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: fluxo de caixa ────────────────────────────────────────────────

  function FluxoCaixa() {
    const accBalance = prevBalance + balance;
    // Saldo após a 1ª quinzena: saldo anterior + receitas da 1ª quinzena - despesas da 1ª quinzena
    const saldoMeio  = prevBalance + q1Income - q1Total;

    function FlowRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
      const pos = value >= 0;
      return (
        <div className="flex items-center justify-between py-1.5">
          <span className={`text-xs ${muted ? "text-slate-400 dark:text-slate-500" : "text-slate-500 dark:text-slate-400"}`}>{label}</span>
          <span className={`text-sm font-semibold ${muted ? "text-slate-400 dark:text-slate-500" : pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
            {pos ? "+" : ""}{formatCurrency(value)}
          </span>
        </div>
      );
    }

    function Mid({ label, value }: { label: string; value: number }) {
      const pos = value >= 0;
      return (
        <div className={`flex items-center justify-between px-3 py-1.5 -mx-4 border-y ${
          pos ? "bg-emerald-50/70 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30"
              : "bg-red-50/70 dark:bg-red-900/20 border-red-100 dark:border-red-800/30"
        }`}>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
          <span className={`text-sm font-bold ${pos ? "text-emerald-600" : "text-red-500"}`}>
            {pos ? "+" : ""}{formatCurrency(value)}
          </span>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 pt-3 pb-4 mb-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
            Fluxo de Caixa · {getMonthName(month)} {year}
          </span>
          <button
            onClick={() => { setEditAccConfig({ ...accConfig }); setAccModal(true); }}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            title="Configurar saldo acumulado"
          >
            <Settings size={12} className="text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {prevBalance !== 0 && <FlowRow label="Saldo anterior" value={prevBalance} muted />}
          {q1Income > 0 && <FlowRow label="Receitas 1ª Quinzena" value={q1Income} />}
          <FlowRow label="1ª Quinzena (dias 1–15)" value={-q1Total} />
        </div>

        <Mid label="Pós 1ª quinzena" value={saldoMeio} />

        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {q2Income > 0 && <FlowRow label="Receitas 2ª Quinzena" value={q2Income} />}
          <FlowRow label="2ª Quinzena (dias 16–30)" value={-q2Total} />
        </div>

        {/* Saldo final */}
        <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl mt-3 border ${
          accBalance >= 0
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30"
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Saldo final</p>
              {balanceOverride && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 font-medium">
                  {balanceOverride.auto_zero ? "Zerado" : "Ajustado"}
                </span>
              )}
            </div>
            {prevBalance !== 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Mês: {balance >= 0 ? "+" : ""}{formatCurrency(balance)}
              </p>
            )}
            {balanceOverride?.notes && (
              <p className="text-xs text-violet-500 italic mt-0.5">{balanceOverride.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-base font-bold ${accBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {accBalance >= 0 ? "+" : ""}{formatCurrency(accBalance)}
            </span>
            <button
              onClick={openOverrideModal}
              title="Ajustar saldo deste mês"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Sliders size={13} className="text-violet-500" />
            </button>
          </div>
        </div>
      </div>
    );
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

      <FluxoCaixa />

      {viewMode === "cards" ? (
        <>
          {/* Dízimo */}
          <TitheSection />

          {/* Quinzenas */}
          <div className="space-y-6">
            <QuinzenaSection
              label="1ª Quinzena" subtitle="dias 1 a 15"
              bills={q1Bills} cards={q1Cards} totalQ={q1Total}
            />
            <QuinzenaSection
              label="2ª Quinzena" subtitle="dias 16 a 30"
              bills={q2Bills} cards={q2Cards} totalQ={q2Total}
            />
          </div>
        </>
      ) : (
        <SpreadsheetView />
      )}

      {/* Modal: ajustar saldo do mês (override) */}
      {overrideModal && (
        <Modal open onClose={() => setOverrideModal(false)} title="Ajustar Saldo do Mês" size="sm">
          <div className="space-y-4">
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/30 rounded-lg p-3">
              <p className="text-xs text-violet-700 dark:text-violet-300 font-medium mb-1">
                Quando usar este ajuste?
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400">
                Quando um emprestimo cobriu o deficit do mes ou quando o saldo real e diferente do calculado.
                O proximo mes usara o valor ajustado como saldo anterior.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Zerar saldo</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Emprestimo cobriu o deficit</p>
              </div>
              <Toggle
                checked={overrideForm.autoZero}
                onChange={v => setOverrideForm(p => ({ ...p, autoZero: v, amount: v ? "0" : p.amount }))}
              />
            </div>

            {!overrideForm.autoZero && (
              <div>
                <label className="label">Saldo real deste mes (R$)</label>
                <input
                  className="input" type="number" step="0.01"
                  value={overrideForm.amount}
                  onChange={e => setOverrideForm(p => ({ ...p, amount: e.target.value }))}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Saldo calculado: {formatCurrency(prevBalance + balance)}
                </p>
              </div>
            )}

            <div>
              <label className="label">Observacao (opcional)</label>
              <input
                className="input"
                placeholder="Ex: Emprestimo SIM cobriu deficit, Peguei emprestado..."
                value={overrideForm.notes}
                onChange={e => setOverrideForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-2">
              {balanceOverride && (
                <button onClick={removeOverride} className="btn-danger flex-1">
                  Remover ajuste
                </button>
              )}
              <button onClick={() => setOverrideModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={saveOverride} className="btn-primary flex-1">Salvar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: configurar saldo acumulado */}
      {accModal && (
        <Modal open onClose={() => setAccModal(false)} title="Configurar Saldo Acumulado" size="sm">
          <div className="space-y-4">
            <div>
              <label className="label">Saldo inicial (R$)</label>
              <input
                className="input" type="number" step="0.01" autoFocus
                value={editAccConfig.saldoInicial}
                onChange={e => setEditAccConfig(p => ({ ...p, saldoInicial: Number(e.target.value) }))}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Valor que você já tinha antes do período de acumulação (ex.: poupança, saldo em conta).
              </p>
            </div>
            <div>
              <label className="label">Início do acumulado</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="input"
                  value={editAccConfig.startMonth}
                  onChange={e => setEditAccConfig(p => ({ ...p, startMonth: Number(e.target.value) }))}
                >
                  {MONTHS.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </select>
                <input
                  className="input" type="number" min="2020" max="2099"
                  value={editAccConfig.startYear}
                  onChange={e => setEditAccConfig(p => ({ ...p, startYear: Number(e.target.value) }))}
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Meses anteriores a esta data serão ignorados no cálculo acumulado.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setAccModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={saveAccConfigModal} className="btn-primary flex-1">Salvar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: editar valor do mês */}
      {editModal && (
        <Modal
          open
          onClose={() => setEditModal(null)}
          title={`Editar valor — ${editModal.bill.name}`}
          size="sm"
        >
          <div className="space-y-3">
            <div>
              <label className="label">Valor (R$) neste mês</label>
              <input
                className="input" type="number" step="0.01" autoFocus
                value={editModal.amount}
                onChange={e => setEditModal(p => p && { ...p, amount: e.target.value })}
              />
              {editModal.bill.is_tithe && (
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                  Calculado automaticamente: {formatCurrency(tithe.total)} (10% de {formatCurrency(incomeTotal)})
                </p>
              )}
            </div>
            <div>
              <label className="label">Observação (opcional)</label>
              <input
                className="input"
                placeholder="Ex: Empréstimo incluído, Desconto recebido…"
                value={editModal.notes}
                onChange={e => setEditModal(p => p && { ...p, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditModal(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={saveEdit} className="btn-primary flex-1">
                Salvar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: adiantar pagamento */}
      {advanceModal && (
        <Modal
          open
          onClose={() => setAdvanceModal(null)}
          title={`Adiantar — ${advanceModal.bill.name}`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/30 rounded-lg p-3">
              <p className="text-xs text-violet-700 dark:text-violet-300 font-medium mb-1 flex items-center gap-1.5">
                <ChevronsRight size={12} /> Como funciona o adiantamento?
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400">
                O valor será debitado do mês atual e a parcela do mês selecionado ficará marcada como pré-paga, sem impactar o saldo daquele mês.
              </p>
            </div>

            <div>
              <label className="label">Adiantar para qual mês?</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="input"
                  value={advanceModal.targetMonth}
                  onChange={e => setAdvanceModal(p => p && { ...p, targetMonth: Number(e.target.value) })}
                >
                  {MONTHS.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </select>
                <input
                  className="input" type="number" min="2024" max="2099"
                  value={advanceModal.targetYear}
                  onChange={e => setAdvanceModal(p => p && { ...p, targetYear: Number(e.target.value) })}
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Mês atual: {MONTHS[month - 1]}/{year}
              </p>
            </div>

            <div>
              <label className="label">Valor (R$)</label>
              <input
                className="input" type="number" step="0.01" autoFocus
                value={advanceModal.amount}
                onChange={e => setAdvanceModal(p => p && { ...p, amount: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Observação (opcional)</label>
              <input
                className="input"
                placeholder="Ex: Adiantei 2 meses, Pagamento extra..."
                value={advanceModal.notes}
                onChange={e => setAdvanceModal(p => p && { ...p, notes: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setAdvanceModal(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={saveAdvance} className="btn-primary flex-1">
                Confirmar Adiantamento
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
