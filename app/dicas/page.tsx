"use client";

import { useEffect, useState } from "react";
import {
  Lightbulb, AlertTriangle, CheckCircle2,
  TrendingUp, CreditCard, PiggyBank, ShieldCheck, Target,
  Zap, BookOpen, Info,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthSelector } from "@/components/ui/MonthSelector";
import {
  getIncomeSources, getMonthlyIncomes, getFixedBills, getMonthlyBillPayments,
  getCardTransactions, getCreditCards, getCategories,
} from "@/lib/queries";
import {
  formatCurrency, getCurrentMonth, getMonthName,
  filterRegularBills, computeInstallment,
} from "@/lib/utils";
import type {
  FixedBill, MonthlyBillPayment,
  CardTransaction, CreditCard as CreditCardType, Category,
} from "@/types";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TipType = "danger" | "warning" | "success" | "info" | "tip";

interface Tip {
  id: string;
  type: TipType;
  title: string;
  description: string;
  value?: string;
}

// ─── Geração de dicas ────────────────────────────────────────────────────────

function generateTips(params: {
  incomeTotal: number;
  totalBills: number;
  cardTotal: number;
  visibleBills: FixedBill[];
  billPayments: MonthlyBillPayment[];
  cardTxs: CardTransaction[];
  creditCards: CreditCardType[];
  categories: Category[];
  month: number;
  year: number;
}): Tip[] {
  const {
    incomeTotal, totalBills, cardTotal, visibleBills,
    billPayments, cardTxs, creditCards, month, year,
  } = params;

  const tips: Tip[] = [];
  const totalExpenses = totalBills + cardTotal;
  const comprometimento = incomeTotal > 0 ? totalExpenses / incomeTotal : 0;
  const savingsRate = incomeTotal > 0 ? (incomeTotal - totalExpenses) / incomeTotal : 0;
  const cardPct = totalExpenses > 0 ? cardTotal / totalExpenses : 0;

  // ── Saúde geral ────────────────────────────────────────────────────────────

  if (incomeTotal === 0) {
    tips.push({
      id: "no-income",
      type: "warning",
      title: "Nenhuma receita registrada",
      description: "Cadastre suas fontes de renda em Lançamentos > Receitas para obter análises precisas.",
    });
  } else if (comprometimento > 0.95) {
    tips.push({
      id: "critical-budget",
      type: "danger",
      title: "Orçamento crítico",
      description: `Você está comprometendo ${(comprometimento * 100).toFixed(0)}% da sua renda com despesas. Revise seus gastos com urgência para evitar dívidas.`,
      value: `${(comprometimento * 100).toFixed(0)}% da renda`,
    });
  } else if (comprometimento > 0.85) {
    tips.push({
      id: "high-expenses",
      type: "warning",
      title: "Gastos elevados",
      description: `${(comprometimento * 100).toFixed(0)}% da renda está comprometido. O ideal é ficar abaixo de 80% para ter margem de segurança.`,
      value: `${(comprometimento * 100).toFixed(0)}% da renda`,
    });
  } else if (savingsRate >= 0.2) {
    tips.push({
      id: "great-savings",
      type: "success",
      title: "Excelente controle financeiro!",
      description: `Você está economizando ${(savingsRate * 100).toFixed(0)}% da renda. Continue assim — você está acima da meta recomendada de 20%.`,
      value: `${formatCurrency(incomeTotal * savingsRate)} economizados`,
    });
  } else if (savingsRate > 0) {
    tips.push({
      id: "saving-ok",
      type: "info",
      title: "Você está economizando",
      description: `${(savingsRate * 100).toFixed(0)}% da renda está sendo poupado. Tente aumentar para 20% fazendo pequenos cortes nas categorias supérfluas.`,
      value: `${formatCurrency(incomeTotal * savingsRate)} livres`,
    });
  }

  // ── Parcelas ativas ────────────────────────────────────────────────────────

  const withInstallments = visibleBills.filter(b =>
    b.installment_total && b.installment_total > 1 && computeInstallment(b, month, year) !== null
  );
  if (withInstallments.length >= 5) {
    tips.push({
      id: "many-installments",
      type: "warning",
      title: `${withInstallments.length} compras parceladas ativas`,
      description: "Muitos parcelamentos reduzem sua flexibilidade financeira. Evite novas compras a prazo até quitar as atuais.",
      value: formatCurrency(withInstallments.reduce((s, b) => s + b.amount, 0)) + "/mês",
    });
  } else if (withInstallments.length > 0) {
    tips.push({
      id: "installments-ok",
      type: "info",
      title: `${withInstallments.length} parcela${withInstallments.length > 1 ? "s" : ""} em andamento`,
      description: "Você tem compras parceladas ativas. Prefira pagamentos à vista quando possível para evitar acúmulo de compromissos.",
      value: formatCurrency(withInstallments.reduce((s, b) => s + b.amount, 0)) + "/mês",
    });
  }

  // ── Uso de cartões ────────────────────────────────────────────────────────

  if (cardPct > 0.6 && cardTotal > 0) {
    tips.push({
      id: "high-card-usage",
      type: "warning",
      title: "Alto uso de cartão de crédito",
      description: `${(cardPct * 100).toFixed(0)}% dos seus gastos passam pelo cartão. Revise assinaturas, compras por impulso e serviços que podem ser cortados.`,
      value: formatCurrency(cardTotal),
    });
  }

  if (creditCards.length > 1 && cardTotal > 0) {
    const cardTotalsMap: Record<string, number> = {};
    cardTxs.forEach(tx => {
      if (tx.amount < 0) {
        cardTotalsMap[tx.card_id] = (cardTotalsMap[tx.card_id] ?? 0) - tx.amount;
      }
    });
    const topCard = creditCards
      .map(c => ({ card: c, total: cardTotalsMap[c.id] ?? 0 }))
      .sort((a, b) => b.total - a.total)[0];
    if (topCard && topCard.total > 0) {
      tips.push({
        id: "top-card",
        type: "tip",
        title: `Cartão mais usado: ${topCard.card.name}`,
        description: `Este cartão concentra ${formatCurrency(topCard.total)} em gastos neste mês. Monitore de perto para evitar surpresas na fatura.`,
        value: formatCurrency(topCard.total),
      });
    }
  }

  // ── Contas a vencer ────────────────────────────────────────────────────────

  const now = new Date();
  const today = now.getDate();
  const isCurrentMonth = now.getMonth() + 1 === month && now.getFullYear() === year;

  if (isCurrentMonth) {
    const upcomingBills = visibleBills.filter(b => {
      if (!b.due_day) return false;
      const paid = billPayments.find(p => p.bill_id === b.id && p.paid);
      if (paid) return false;
      return b.due_day >= today && b.due_day <= today + 5;
    });
    if (upcomingBills.length > 0) {
      tips.push({
        id: "upcoming-bills",
        type: "warning",
        title: `${upcomingBills.length} conta${upcomingBills.length > 1 ? "s" : ""} vencendo nos próximos 5 dias`,
        description: upcomingBills.map(b => `${b.name} (dia ${b.due_day})`).join(", "),
        value: formatCurrency(upcomingBills.reduce((s, b) => s + b.amount, 0)),
      });
    }

    const overdueBills = visibleBills.filter(b => {
      if (!b.due_day) return false;
      const paid = billPayments.find(p => p.bill_id === b.id && p.paid);
      if (paid) return false;
      return b.due_day < today;
    });
    if (overdueBills.length > 0) {
      tips.push({
        id: "overdue-bills",
        type: "danger",
        title: `${overdueBills.length} conta${overdueBills.length > 1 ? "s" : ""} em atraso`,
        description: overdueBills.map(b => `${b.name} (venceu dia ${b.due_day})`).join(", "),
        value: formatCurrency(overdueBills.reduce((s, b) => s + b.amount, 0)),
      });
    }
  }

  // ── Regra 50-30-20 ─────────────────────────────────────────────────────────

  if (incomeTotal > 0) {
    const necessidades = totalBills;
    const pctNecessidades = (necessidades / incomeTotal) * 100;
    if (pctNecessidades > 60) {
      tips.push({
        id: "rule-5030",
        type: "tip",
        title: "Regra 50/30/20 — necessidades acima do ideal",
        description: `Suas contas fixas representam ${pctNecessidades.toFixed(0)}% da renda. O ideal pela regra 50/30/20 é até 50%. Renegocie contratos ou busque alternativas mais baratas.`,
      });
    }
  }

  return tips;
}

// ─── Score de saúde financeira ───────────────────────────────────────────────

function calcScore(incomeTotal: number, totalExpenses: number, overdue: number, installments: number): number {
  if (incomeTotal === 0) return 0;
  const comprometimento = totalExpenses / incomeTotal;
  let score = 100;
  score -= Math.min(50, comprometimento * 50);
  score -= overdue * 10;
  score -= Math.max(0, installments - 2) * 5;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function scoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: "Excelente", color: "text-emerald-600", bg: "bg-emerald-500" };
  if (score >= 60) return { label: "Bom", color: "text-blue-600", bg: "bg-blue-500" };
  if (score >= 40) return { label: "Atenção", color: "text-amber-600", bg: "bg-amber-500" };
  return { label: "Crítico", color: "text-red-600", bg: "bg-red-500" };
}

// ─── Ícone por tipo ───────────────────────────────────────────────────────────

function TipIcon({ type }: { type: TipType }) {
  const base = "w-8 h-8 rounded-xl flex items-center justify-center shrink-0";
  if (type === "danger")  return <div className={`${base} bg-red-100 dark:bg-red-900/30`}><AlertTriangle size={16} className="text-red-600 dark:text-red-400" /></div>;
  if (type === "warning") return <div className={`${base} bg-amber-100 dark:bg-amber-900/30`}><AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" /></div>;
  if (type === "success") return <div className={`${base} bg-emerald-100 dark:bg-emerald-900/30`}><CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" /></div>;
  if (type === "tip")     return <div className={`${base} bg-violet-100 dark:bg-violet-900/30`}><Lightbulb size={16} className="text-violet-600 dark:text-violet-400" /></div>;
  return <div className={`${base} bg-blue-100 dark:bg-blue-900/30`}><Info size={16} className="text-blue-600 dark:text-blue-400" /></div>;
}

function tipBorder(type: TipType): string {
  if (type === "danger")  return "border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-900/10";
  if (type === "warning") return "border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10";
  if (type === "success") return "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10";
  if (type === "tip")     return "border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-900/10";
  return "border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-900/10";
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DicasPage() {
  const { month: cm, year: cy } = getCurrentMonth();
  const [month, setMonth] = useState(cm);
  const [year, setYear]   = useState(cy);
  const [loading, setLoading] = useState(true);

  const [tips, setTips]             = useState<Tip[]>([]);
  const [score, setScore]           = useState(0);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [cardTotal, setCardTotal]   = useState(0);
  const [savingsAbs, setSavingsAbs] = useState(0);
  const [activeInstallments, setActiveInstallments] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => { loadData(); }, [month, year]);

  async function loadData() {
    setLoading(true);
    try {
      const [sources, incomes, bills, payments, txs, cards, cats] = await Promise.all([
        getIncomeSources(month, year),
        getMonthlyIncomes(month, year),
        getFixedBills(),
        getMonthlyBillPayments(month, year),
        getCardTransactions(month, year),
        getCreditCards(),
        getCategories(),
      ]);

      const inc = sources.reduce((s, src) => {
        const mi = incomes.find(i => i.source_id === src.id);
        return s + (mi?.amount ?? src.base_amount);
      }, 0);

      const regularBills = filterRegularBills(bills);
      const visibleBills = regularBills.filter(b => {
        if (!b.installment_total) return true;
        if (b.installment_start_month == null || b.installment_start_year == null) return true;
        return computeInstallment(b, month, year) !== null;
      });

      const billAmts = visibleBills.reduce((s, b) => {
        const p = payments.find(p => p.bill_id === b.id);
        return s + (p?.amount ?? b.amount);
      }, 0);

      const cardAmt = txs.reduce((s, t) => s - t.amount, 0);
      const totalExp = billAmts + cardAmt;
      const savings = inc - totalExp;

      // Contagem de atrasos (mês atual)
      const now = new Date();
      const today = now.getDate();
      const isCurrentMonth = now.getMonth() + 1 === month && now.getFullYear() === year;
      const overdue = isCurrentMonth
        ? visibleBills.filter(b => {
            if (!b.due_day || b.due_day >= today) return false;
            const paid = payments.find(p => p.bill_id === b.id && p.paid);
            return !paid;
          }).length
        : 0;

      const installmentCount = visibleBills.filter(b =>
        b.installment_total && b.installment_total > 1 && computeInstallment(b, month, year) !== null
      ).length;

      const generatedTips = generateTips({
        incomeTotal: inc,
        totalBills: billAmts,
        cardTotal: cardAmt,
        visibleBills,
        billPayments: payments,
        cardTxs: txs,
        creditCards: cards,
        categories: cats,
        month,
        year,
      });

      setIncomeTotal(inc);
      setTotalExpenses(totalExp);
      setCardTotal(cardAmt);
      setSavingsAbs(savings);
      setActiveInstallments(installmentCount);
      setOverdueCount(overdue);
      setScore(calcScore(inc, totalExp, overdue, installmentCount));
      setTips(generatedTips);
    } finally {
      setLoading(false);
    }
  }

  const comprometimento = incomeTotal > 0 ? (totalExpenses / incomeTotal) * 100 : 0;
  const { label: scoreText, color: scoreColor, bg: scoreBg } = scoreLabel(score);

  return (
    <div className="p-3 md:p-6 min-h-screen">
      <PageHeader title="Dicas Financeiras" subtitle={`${getMonthName(month)} ${year}`}>
        <MonthSelector month={month} year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Score de Saúde Financeira ────────────────────────────────────── */}
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Score circular */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                      strokeWidth="2.5" className="text-slate-100 dark:text-slate-700" />
                    <circle cx="18" cy="18" r="15.9" fill="none"
                      strokeWidth="2.5"
                      strokeDasharray={`${score} ${100 - score}`}
                      strokeLinecap="round"
                      className={score >= 80 ? "stroke-emerald-500" : score >= 60 ? "stroke-blue-500" : score >= 40 ? "stroke-amber-500" : "stroke-red-500"}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-xl font-black ${scoreColor}`}>{score}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-semibold">Saúde Financeira</p>
                  <p className={`text-lg font-bold ${scoreColor}`}>{scoreText}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Score 0–100</p>
                </div>
              </div>

              {/* Métricas rápidas */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Comprometido</p>
                  <p className={`text-base font-bold ${comprometimento > 85 ? "text-red-600" : comprometimento > 70 ? "text-amber-600" : "text-emerald-600"}`}>
                    {comprometimento.toFixed(0)}%
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Sobra</p>
                  <p className={`text-base font-bold ${savingsAbs >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {savingsAbs >= 0 ? "+" : ""}{formatCurrency(savingsAbs)}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Parcelas</p>
                  <p className={`text-base font-bold ${activeInstallments >= 5 ? "text-amber-600" : "text-slate-700 dark:text-slate-200"}`}>
                    {activeInstallments}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Atrasadas</p>
                  <p className={`text-base font-bold ${overdueCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {overdueCount > 0 ? overdueCount : "Nenhuma"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Dicas Personalizadas ─────────────────────────────────────────── */}
          {tips.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <Lightbulb size={15} className="text-amber-500" />
                Análise Personalizada
              </h2>
              <div className="space-y-2">
                {tips.map(tip => (
                  <div key={tip.id}
                    className={`flex gap-3 p-3.5 rounded-xl border ${tipBorder(tip.type)}`}>
                    <TipIcon type={tip.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{tip.title}</p>
                        {tip.value && (
                          <span className="text-xs font-bold shrink-0 text-slate-600 dark:text-slate-300">
                            {tip.value}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {tip.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Visão Orçamentária ───────────────────────────────────────────── */}
          {incomeTotal > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <Target size={15} className="text-primary-500" />
                Visão do Orçamento
              </h2>
              <div className="space-y-2.5">
                {[
                  { label: "Contas fixas", value: totalExpenses - cardTotal, color: "#6366f1", pct: incomeTotal > 0 ? ((totalExpenses - cardTotal) / incomeTotal) * 100 : 0 },
                  { label: "Cartões", value: cardTotal, color: "#f59e0b", pct: incomeTotal > 0 ? (cardTotal / incomeTotal) * 100 : 0 },
                  { label: "Sobra", value: Math.max(0, savingsAbs), color: "#10b981", pct: incomeTotal > 0 ? Math.max(0, (savingsAbs / incomeTotal) * 100) : 0 },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{item.label}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatCurrency(item.value)}
                        <span className="text-slate-400 font-normal ml-1">({item.pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, item.pct)}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Meta de economia */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Meta recomendada: 20% de economia</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {incomeTotal > 0
                        ? `Alvo: ${formatCurrency(incomeTotal * 0.2)}/mês`
                        : "Cadastre receitas para ver a meta"}
                    </p>
                  </div>
                  {incomeTotal > 0 && (
                    <div className={`text-sm font-bold px-3 py-1 rounded-lg ${
                      savingsAbs >= incomeTotal * 0.2
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    }`}>
                      {savingsAbs >= incomeTotal * 0.2 ? "Atingida!" : `Falta ${formatCurrency(incomeTotal * 0.2 - Math.max(0, savingsAbs))}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Regras de Ouro ───────────────────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <BookOpen size={15} className="text-primary-500" />
              Regras de Ouro das Finanças
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  icon: <Target size={16} className="text-violet-500" />,
                  title: "Regra 50/30/20",
                  desc: "50% para necessidades, 30% para desejos e 20% para poupança e investimentos.",
                  bg: "bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800/30",
                },
                {
                  icon: <ShieldCheck size={16} className="text-emerald-500" />,
                  title: "Fundo de Emergência",
                  desc: incomeTotal > 0
                    ? `Mantenha de 3 a 6 meses de despesas reservados (${formatCurrency(totalExpenses * 3)}–${formatCurrency(totalExpenses * 6)}).`
                    : "Mantenha de 3 a 6 meses de despesas em reserva de fácil acesso.",
                  bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30",
                },
                {
                  icon: <CreditCard size={16} className="text-red-500" />,
                  title: "Evite o Rotativo",
                  desc: "Nunca pague o mínimo do cartão. Os juros do rotativo superam 300% ao ano — quite sempre a fatura completa.",
                  bg: "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30",
                },
                {
                  icon: <PiggyBank size={16} className="text-amber-500" />,
                  title: "Pague-se Primeiro",
                  desc: "Separe a parcela de economia assim que receber o salário, antes de qualquer gasto. Trate como uma despesa obrigatória.",
                  bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30",
                },
                {
                  icon: <Zap size={16} className="text-blue-500" />,
                  title: "Corte o Supérfluo",
                  desc: "Revise mensalmente suas assinaturas e serviços. Pequenos valores somam muito ao longo do ano.",
                  bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30",
                },
                {
                  icon: <TrendingUp size={16} className="text-primary-500" />,
                  title: "Invista o que Sobra",
                  desc: "Dinheiro parado perde valor com a inflação. Mesmo pequenas quantias aplicadas regularmente crescem exponencialmente.",
                  bg: "bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800/30",
                },
              ].map(card => (
                <div key={card.title} className={`flex gap-3 p-3.5 rounded-xl border ${card.bg}`}>
                  <div className="w-8 h-8 rounded-xl bg-white/60 dark:bg-slate-800/40 flex items-center justify-center shrink-0">
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{card.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
