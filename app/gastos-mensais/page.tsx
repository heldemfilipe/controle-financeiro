"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, CreditCard, FileText, Pencil, ChevronDown, ChevronRight, Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import {
  getFixedBills, getMonthlyBillPayments, toggleBillPaid, updateBillPaymentAmount,
  getCreditCards, getCardTransactions, getMonthlyCardPayments, toggleCardPaid,
  getMonthlyIncomes, getIncomeSources,
} from "@/lib/queries";
import { formatCurrency, getCurrentMonth, getMonthName, isOverdue, isDueSoon, computeInstallment, getAccConfig, saveAccConfig } from "@/lib/utils";
import type { AccumuladoConfig } from "@/lib/utils";
import { MONTHS } from "@/types";
import type {
  FixedBill, CreditCard as CCType, MonthlyBillPayment,
  MonthlyCardPayment, IncomeSource, MonthlyIncome, CardTransaction,
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

  // ── Modal de edição de valor ───────────────────────────────────────────────
  const [editModal, setEditModal] = useState<{
    bill: FixedBill; amount: string; notes: string;
  } | null>(null);

  useEffect(() => { loadAll(); }, [month, year, accConfig]);

  async function loadAll() {
    setLoading(true);
    try {
      const [
        bills, payments, cards, cardPays, txs, sources, incomes,
      ] = await Promise.all([
        getFixedBills(),
        getMonthlyBillPayments(month, year),
        getCreditCards(),
        getMonthlyCardPayments(month, year),
        getCardTransactions(month, year),
        getIncomeSources(),
        getMonthlyIncomes(month, year),
      ]);

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
          .reduce((s, t) => s + Math.abs(t.amount), 0);
      });
      setCardTotals(totals);

      // ── Saldo acumulado: soma os saldos do mês de início até mês-1 ─────────
      const baseRecurringIncome = sources
        .filter(s => s.is_recurring !== false)
        .reduce((s, src) => s + src.base_amount, 0);

      const cfg = accConfig; // snapshot do config atual
      // Determina quais meses entram na acumulação
      let monthsToLoad: number[];
      if (year === cfg.startYear) {
        // Mesmo ano: acumula apenas de startMonth até month-1
        monthsToLoad = month > cfg.startMonth
          ? Array.from({ length: month - cfg.startMonth }, (_, i) => cfg.startMonth + i)
          : [];
      } else if (year > cfg.startYear) {
        // Ano posterior: acumula tudo de Jan até month-1
        monthsToLoad = month > 1
          ? Array.from({ length: month - 1 }, (_, i) => i + 1)
          : [];
      } else {
        // Ano anterior ao início: nada
        monthsToLoad = [];
      }

      if (monthsToLoad.length === 0) {
        setPrevBalance(cfg.saldoInicial);
      } else {
        const monthlyBalances = await Promise.all(
          monthsToLoad.map(async (m) => {
            const [incData, billPay, txs2] = await Promise.all([
              getMonthlyIncomes(m, year),
              getMonthlyBillPayments(m, year),
              getCardTransactions(m, year),
            ]);
            const inc2 = incData.length > 0
              ? incData.reduce((s, i) => s + i.amount, 0)
              : baseRecurringIncome;
            const activeBills = bills.filter(bill => {
              if (!bill.installment_total) return true;
              if (bill.installment_start_month == null || bill.installment_start_year == null) return true;
              return computeInstallment(bill, m, year) !== null;
            });
            const billIds2 = billPay.map(b => b.bill_id);
            const missingBills2 = activeBills.filter(b => !billIds2.includes(b.id));
            const bills2 = [
              ...billPay.map(b => b.amount ?? (b as any).fixed_bills?.amount ?? activeBills.find(f => f.id === b.bill_id)?.amount ?? 0),
              ...missingBills2.map(b => b.amount),
            ].reduce((s, v) => s + v, 0);
            const cards2 = txs2.reduce((s, t) => s + Math.abs(t.amount), 0);
            return inc2 - bills2 - cards2;
          })
        );
        setPrevBalance(cfg.saldoInicial + monthlyBalances.reduce((s, v) => s + v, 0));
      }
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

  /** Valor efetivo da conta no mês (payment sobrescreve a base) */
  function billAmount(bill: FixedBill): number {
    const p = billPayments.find(p => p.bill_id === bill.id);
    return p?.amount ?? (bill.is_tithe ? tithe.total : bill.amount);
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
  const q1Bills = visibleRegularBills.filter(b => b.period === "1-15");
  const q2Bills = visibleRegularBills.filter(b => b.period === "16-30");
  const q1Cards = creditCards.filter(c => c.due_day <= 15);
  const q2Cards = creditCards.filter(c => c.due_day > 15);

  const tithePayment      = titheBill ? billPayments.find(p => p.bill_id === titheBill.id) : undefined;
  const titheDisplayAmt   = tithePayment?.amount ?? tithe.total;
  const tithePeriod       = titheBill?.period ?? "16-30";

  const q1BillsSum = q1Bills.reduce((s, b) => s + billAmount(b), 0);
  const q2BillsSum = q2Bills.reduce((s, b) => s + billAmount(b), 0);
  const q1CardsSum = q1Cards.reduce((s, c) => s + (cardTotals[c.id] ?? 0), 0);
  const q2CardsSum = q2Cards.reduce((s, c) => s + (cardTotals[c.id] ?? 0), 0);

  const q1Total = q1BillsSum + q1CardsSum + (tithePeriod === "1-15"  ? titheDisplayAmt : 0);
  const q2Total = q2BillsSum + q2CardsSum + (tithePeriod === "16-30" ? titheDisplayAmt : 0);
  const balance = incomeTotal - q1Total - q2Total;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function saveAccConfigModal() {
    saveAccConfig(editAccConfig);
    setAccConfig(editAccConfig);
    setAccModal(false);
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
    const status  = billSt(bill);
    const amount  = billAmount(bill);
    const payment = billPayments.find(p => p.bill_id === bill.id);
    const soon    = status === "pending" && isDueSoon(bill.due_day, month, year);

    // Cor do card conforme situação de vencimento
    const rowBg =
      status === "overdue"
        ? "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40"
        : soon
        ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40"
        : "bg-white dark:bg-slate-800";

    return (
      <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 shadow-sm gap-2 ${rowBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon status={status} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{bill.name}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {bill.due_day && (
                <span className={`text-xs ${
                  status === "overdue" ? "text-red-500" :
                  soon ? "text-amber-600 dark:text-amber-400" :
                  "text-slate-400 dark:text-slate-500"
                }`}>
                  dia {bill.due_day}
                  {soon && " · vence em breve"}
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
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                -{formatCurrency(amount)}
              </span>
              <button
                onClick={() => openEdit(bill)}
                title="Editar valor deste mês"
                className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <Pencil size={10} className="text-slate-400 dark:text-slate-500" />
              </button>
            </div>
            {status === "overdue" && !payment?.paid && (
              <span className="text-xs text-red-500 font-medium">Vencida!</span>
            )}
          </div>
          <Toggle checked={payment?.paid ?? false} onChange={v => handleToggleBill(bill, v)} />
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

    // Quantas são parceladas (installment_total > 1)
    const parcelCount = txs.filter(t => t.installment_total > 1).length;

    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl shadow-sm overflow-hidden">
        {/* Cabeçalho do cartão */}
        <div className="p-3">
          <div className="flex items-center justify-between">
            {/* Info + botão expandir */}
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
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 dark:text-slate-500 capitalize">{card.owner}</span>
                  <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-medium">
                    Dia {card.due_day}
                  </span>
                  {txs.length > 0 && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {txs.length} lanç.{parcelCount > 0 && ` · ${parcelCount} parc.`}
                    </span>
                  )}
                </div>
              </div>
              {txs.length > 0 && (
                isOpen
                  ? <ChevronDown size={14} className="text-slate-400 dark:text-slate-500 shrink-0 ml-1" />
                  : <ChevronRight size={14} className="text-slate-400 dark:text-slate-500 shrink-0 ml-1" />
              )}
            </button>

            {/* Valor + toggle */}
            <div className="flex items-center gap-2.5 shrink-0 ml-2">
              <div className="text-right">
                <p className={`text-sm font-bold ${total > 0 ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-600"}`}>
                  {formatCurrency(total)}
                </p>
                {status === "paid" ? (
                  <p className="text-xs text-emerald-600">✓ Pago</p>
                ) : status === "overdue" && total > 0 ? (
                  <p className="text-xs text-red-500">Vencida</p>
                ) : total > 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">Pendente</p>
                ) : null}
              </div>
              <Toggle
                checked={payment?.paid ?? false}
                onChange={v => handleToggleCard(card, v)}
                disabled={total === 0}
              />
            </div>
          </div>

          {/* Barra de progresso */}
          {total > 0 && incomeTotal > 0 && (
            <div className="mt-2.5">
              <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-1 rounded-full transition-all"
                  style={{ width: `${Math.min((total / incomeTotal) * 100, 100)}%`, backgroundColor: card.color }}
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {((total / incomeTotal) * 100).toFixed(1)}% da renda
              </p>
            </div>
          )}
        </div>

        {/* Lista de parcelas — expande ao clicar */}
        {isOpen && (
          <div className="border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 space-y-1.5">
            {txs.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-1 text-center">
                Nenhum lançamento neste mês
              </p>
            ) : (
              txs.map(tx => (
                <div key={tx.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs text-slate-600 dark:text-slate-300 truncate block">
                      {tx.description}
                    </span>
                    {tx.installment_total > 1 && (
                      <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                        {tx.installment_current}/{tx.installment_total}x
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-red-500 shrink-0">
                    -{formatCurrency(Math.abs(tx.amount))}
                  </span>
                </div>
              ))
            )}
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
    const billsSum = bills.reduce((s, b) => s + billAmount(b), 0);
    const cardsSum = cards.reduce((s, c) => s + (cardTotals[c.id] ?? 0), 0);

    // Agrupamento dinâmico por categoria (suporta categorias customizadas)
    const catGroups = Array.from(new Set(bills.map(b => b.category || "outros")));

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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
                  const catBills = bills.filter(b => (b.category || "outros") === cat);
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
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 flex justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {bills.filter(b => billPayments.find(p => p.bill_id === b.id)?.paid).length}/{bills.length} pagas
                  </span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {formatCurrency(billsSum)}
                  </span>
                </div>
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
                {cards.map(c => <CardRow key={c.id} card={c} />)}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 flex justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {cards.filter(c => cardPayments.find(p => p.card_id === c.id)?.paid).length}/{cards.filter(c => (cardTotals[c.id] ?? 0) > 0).length} pagas
                  </span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {formatCurrency(cardsSum)}
                  </span>
                </div>
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

  // ── Render principal ───────────────────────────────────────────────────────

  return (
    <div className="p-6 min-h-screen">
      <PageHeader title="Gastos Mensais" subtitle="Controle de pagamentos por quinzena">
        <MonthSelector month={month} year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </PageHeader>

      {/* Barra de resumo */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3.5 transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Receitas</p>
          <p className="text-lg font-bold text-emerald-600">+{formatCurrency(incomeTotal)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3.5 transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">1ª Quinzena</p>
          <p className="text-lg font-bold text-primary-600">-{formatCurrency(q1Total)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">dias 1 – 15</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3.5 transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">2ª Quinzena</p>
          <p className="text-lg font-bold text-amber-600">-{formatCurrency(q2Total)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">dias 16 – 30</p>
        </div>
        {(() => {
          const accBalance = prevBalance + balance;
          return (
            <div className={`rounded-xl p-3.5 border transition-colors ${
              accBalance >= 0
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30"
                : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30"
            }`}>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Saldo acumulado</p>
              <p className={`text-lg font-bold ${accBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {accBalance >= 0 ? "+" : ""}{formatCurrency(accBalance)}
              </p>
              {prevBalance !== 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  mês: {balance >= 0 ? "+" : ""}{formatCurrency(balance)}
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {/* Carry-over: saldo acumulado com base na config */}
      {(() => {
        const accBalance = prevBalance + balance;

        // Meses efetivamente acumulados (com base em accConfig)
        const startM = accConfig.startMonth;
        const startY = accConfig.startYear;
        const firstAcc = year === startY ? startM : 1;
        const lastAcc  = month - 1;

        // Label do período: "Abr/2026", "Jan–Mar/2026", etc.
        const prevPeriodLabel = (() => {
          if (lastAcc < firstAcc || year < startY) return null;
          if (firstAcc === lastAcc) return `${MONTHS[firstAcc - 1]}/${year}`;
          return `${MONTHS[firstAcc - 1]}–${MONTHS[lastAcc - 1]}/${year}`;
        })();

        return (
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-2.5 mb-6 text-sm border transition-colors ${
            accBalance >= 0
              ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/20"
              : "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/20"
          }`}>
            {/* Saldo inicial personalizado */}
            {accConfig.saldoInicial !== 0 && !prevPeriodLabel && (
              <>
                <span className="text-slate-500 dark:text-slate-400 text-xs">Saldo inicial:</span>
                <span className={`font-semibold text-sm ${accConfig.saldoInicial >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {accConfig.saldoInicial >= 0 ? "+" : ""}{formatCurrency(accConfig.saldoInicial)}
                </span>
                <span className="text-slate-300 dark:text-slate-600">+</span>
              </>
            )}

            {/* Meses anteriores acumulados */}
            {prevPeriodLabel && (
              <>
                <span className="text-slate-500 dark:text-slate-400 text-xs">
                  Acumulado ({prevPeriodLabel}):
                </span>
                <span className={`font-semibold text-sm ${prevBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {prevBalance >= 0 ? "+" : ""}{formatCurrency(prevBalance)}
                </span>
                <span className="text-slate-300 dark:text-slate-600">+</span>
              </>
            )}

            <span className="text-slate-500 dark:text-slate-400 text-xs">{getMonthName(month)}:</span>
            <span className={`font-semibold text-sm ${balance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {balance >= 0 ? "+" : ""}{formatCurrency(balance)}
            </span>
            <span className="text-slate-300 dark:text-slate-600">=</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Saldo acumulado:</span>
            <span className={`font-bold text-base ${accBalance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>
              {accBalance >= 0 ? "+" : ""}{formatCurrency(accBalance)}
            </span>

            {/* Botão configurar */}
            <button
              onClick={() => { setEditAccConfig({ ...accConfig }); setAccModal(true); }}
              className="ml-auto p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
              title="Configurar saldo acumulado"
            >
              <Settings size={13} className="text-slate-400 dark:text-slate-500" />
            </button>
          </div>
        );
      })()}

      {/* Dízimo */}
      <TitheSection />

      {/* Quinzenas */}
      <div className="space-y-8">
        <QuinzenaSection
          label="1ª Quinzena" subtitle="dias 1 a 15"
          bills={q1Bills} cards={q1Cards} totalQ={q1Total}
        />
        <QuinzenaSection
          label="2ª Quinzena" subtitle="dias 16 a 30"
          bills={q2Bills} cards={q2Cards} totalQ={q2Total}
        />
      </div>

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
    </div>
  );
}
