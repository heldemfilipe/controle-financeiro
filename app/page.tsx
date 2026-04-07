"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, CreditCard,
  ArrowUpRight, ArrowDownRight, Calendar, Plus, FileText, Calculator
} from "lucide-react";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Line, ReferenceLine
} from "recharts";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import {
  getMonthlyIncomes, getMonthlyBillPayments,
  getCardTransactions, getFixedBills, getCreditCards,
  getMonthlyCardPayments, getIncomeSources, getCategories,
} from "@/lib/queries";
import { computeYearBalances, clearBalanceCache } from "@/lib/balance";
import { formatCurrency, getMonthName, getCurrentMonth, computeInstallment } from "@/lib/utils";
import { MONTH_SHORT } from "@/types";
import type { Category } from "@/types";

const FALLBACK_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899", "#14b8a6"];

function getCatColor(catName: string, cats: Category[], index: number): string {
  const cat = cats.find(c => c.name === catName);
  if (cat?.color) return cat.color;
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export default function DashboardPage() {
  const { month: cm, year: cy } = getCurrentMonth();
  const [month, setMonth] = useState(cm);
  const [year, setYear] = useState(cy);
  const [loading, setLoading] = useState(true);
  const [showOnlySaldo, setShowOnlySaldo] = useState(false);

  const [totalIncome, setTotalIncome] = useState(0);
  const [totalBills, setTotalBills] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [balance, setBalance] = useState(0);
  const [yearlyData, setYearlyData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [catKeys, setCatKeys] = useState<{ key: string; color: string }[]>([]);
  const [cardsPaid, setCardsPaid] = useState<any[]>([]);
  const [accBalance, setAccBalance] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [month, year]);

  async function loadData() {
    setLoading(true);
    try {
      const [incomes, bills, txs, allBills, cards, cardPayments, incomeSrcs, cats] = await Promise.all([
        getMonthlyIncomes(month, year),
        getMonthlyBillPayments(month, year),
        getCardTransactions(month, year),
        getFixedBills(),
        getCreditCards(),
        getMonthlyCardPayments(month, year),
        getIncomeSources(),
        getCategories(),
      ]);

      // ── Receita do mês ────────────────────────────────────────────────────────
      const inc = incomeSrcs.reduce((s, src) => {
        const mi = incomes.find(i => i.source_id === src.id);
        if (src.is_recurring === false) {
          if (src.one_time_month !== month || src.one_time_year !== year) return s;
        }
        return s + (mi?.amount ?? src.base_amount);
      }, 0);

      // ── Filtra contas ─────────────────────────────────────────────────────────
      const titheBillItem = allBills.find(b => b.is_tithe);
      const regularAllBills = allBills.filter(b => !b.is_tithe);
      const visibleBills = regularAllBills.filter(bill => {
        if (!bill.installment_total) return true;
        if (bill.installment_start_month == null || bill.installment_start_year == null) return true;
        return computeInstallment(bill, month, year) !== null;
      });

      // Merge pagamentos + contas sem registro
      const billIds = bills.map(b => b.bill_id);
      const missingBills = visibleBills.filter(b => !billIds.includes(b.id));
      const regularItems: { amount: number; category: string }[] = [
        ...bills
          .filter(b => visibleBills.some(vb => vb.id === b.bill_id))
          .map(b => ({ amount: b.amount ?? b.fixed_bills?.amount ?? 0, category: b.fixed_bills?.category ?? "outros" })),
        ...missingBills.map(b => ({ amount: b.amount, category: b.category })),
      ];

      // Dízimo
      const tithePayment = titheBillItem ? bills.find(b => b.bill_id === titheBillItem.id) : null;
      const titheAmt = tithePayment?.amount ?? (titheBillItem ? inc * 0.1 : 0);
      const titheCategory = titheBillItem?.category ?? "essencial";
      const allBillsThisMonth = titheBillItem
        ? [...regularItems, { amount: titheAmt, category: titheCategory }]
        : regularItems;

      // Agrupa por categoria
      const billsByCat: Record<string, number> = {};
      allBillsThisMonth.forEach(b => {
        billsByCat[b.category] = (billsByCat[b.category] ?? 0) + b.amount;
      });
      const billsTotal = Object.values(billsByCat).reduce((s, v) => s + v, 0);

      // Cartões — líquido (créditos abate)
      const cardsTotal = txs.reduce((s, t) => s - t.amount, 0);

      setTotalIncome(inc);
      setTotalBills(billsTotal);
      setTotalCards(cardsTotal);
      setBalance(inc - billsTotal - cardsTotal);

      // ── Pie chart: categorias reais + cartões ─────────────────────────────────
      const pieEntries = Object.entries(billsByCat).map(([catName, value], idx) => ({
        name: catName.charAt(0).toUpperCase() + catName.slice(1),
        value,
        color: getCatColor(catName, cats, idx),
      }));
      if (cardsTotal > 0) pieEntries.push({ name: "Cartões", value: cardsTotal, color: "#ef4444" });
      setPieData(pieEntries);

      // ── Cards summary — usa total confirmado de monthly_card_payments quando disponível ─
      const cardSummary = cards.map(card => {
        const cardTxs = txs.filter(t => t.card_id === card.id);
        const txTotal = cardTxs.reduce((s, t) => s - t.amount, 0);
        const payment = cardPayments.find(p => p.card_id === card.id);
        // Prefere o total armazenado no pagamento (fatura confirmada); senão usa soma das transações
        const total = payment?.total_amount ?? txTotal;
        return { ...card, total, paid: payment?.paid ?? false };
      }).filter(c => c.total > 0);
      setCardsPaid(cardSummary);

      // ── Yearly chart: categorias dinâmicas ───────────────────────────────────
      const allCatKeys = new Set<string>();

      const yearlyPromises = Array.from({ length: 12 }, async (_, i) => {
        const m = i + 1;
        const [inc2, billPay, txs2] = await Promise.all([
          getMonthlyIncomes(m, year),
          getMonthlyBillPayments(m, year),
          getCardTransactions(m, year),
        ]);

        const income2 = incomeSrcs.reduce((s, src) => {
          const mi = inc2.find(i => i.source_id === src.id);
          if (src.is_recurring === false) {
            if (src.one_time_month !== m || src.one_time_year !== year) return s;
          }
          return s + (mi?.amount ?? src.base_amount);
        }, 0);

        const visible2 = regularAllBills.filter(bill => {
          if (!bill.installment_total) return true;
          if (bill.installment_start_month == null || bill.installment_start_year == null) return true;
          return computeInstallment(bill, m, year) !== null;
        });
        const billIds2 = billPay.map(b => b.bill_id);
        const missing2 = visible2.filter(b => !billIds2.includes(b.id));

        const tithePay2 = titheBillItem ? billPay.find(b => b.bill_id === titheBillItem.id) : null;
        const titheAmt2 = tithePay2?.amount ?? (titheBillItem ? income2 * 0.1 : 0);
        const titheCategory2 = titheBillItem?.category ?? "essencial";

        const billsWithCats2: { amount: number; category: string }[] = [
          ...billPay
            .filter(b => visible2.some(vb => vb.id === b.bill_id))
            .map(b => ({ amount: b.amount ?? b.fixed_bills?.amount ?? 0, category: b.fixed_bills?.category ?? "outros" })),
          ...missing2.map(b => ({ amount: b.amount, category: b.category })),
        ];
        if (titheBillItem) billsWithCats2.push({ amount: titheAmt2, category: titheCategory2 });

        const catTotals2: Record<string, number> = {};
        billsWithCats2.forEach(b => {
          catTotals2[b.category] = (catTotals2[b.category] ?? 0) + b.amount;
          allCatKeys.add(b.category);
        });

        const cards2 = txs2.reduce((s, t) => s - t.amount, 0);
        const despesas2 = Object.values(catTotals2).reduce((s, v) => s + v, 0) + cards2;

        return {
          name: MONTH_SHORT[i],
          receitas: income2,
          ...catTotals2,
          cartoes: cards2,
          despesas: despesas2,
        };
      });

      const ydRaw = await Promise.all(yearlyPromises);

      // Garante que todos os meses têm todos os keys de categoria (preenche 0)
      const finalCatKeys = Array.from(allCatKeys);
      const yd = ydRaw.map(d => {
        const row = { ...d } as any;
        finalCatKeys.forEach(k => { if (row[k] === undefined) row[k] = 0; });
        return row;
      });

      setCatKeys(finalCatKeys.map((k, i) => ({ key: k, color: getCatColor(k, cats, i) })));

      // Saldo acumulado — usa módulo centralizado (respeita overrides + carry-over)
      clearBalanceCache();
      const accYear = await computeYearBalances(year);
      const ydWithAcc = yd.map((d, i) => ({
        ...d,
        saldoAcumulado: accYear[i]?.saldoAcumulado ?? null,
      }));
      setYearlyData(ydWithAcc);

      const monthAcc = accYear[month - 1]?.saldoAcumulado ?? null;
      setAccBalance(typeof monthAcc === "number" ? monthAcc : null);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const totalExpenses = totalBills + totalCards;

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <PageHeader
        title="Dashboard"
        subtitle={`Visão geral de ${getMonthName(month)} ${year}`}
      >
        <MonthSelector
          month={month}
          year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }}
        />
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
        <SummaryCard
          title="Receitas"
          value={totalIncome}
          icon={TrendingUp}
          variant="income"
          subtitle="Total recebido"
        />
        <SummaryCard
          title="Contas"
          value={totalBills}
          icon={TrendingDown}
          variant="expense"
          subtitle="Todas as categorias"
        />
        <SummaryCard
          title="Faturas Cartões"
          value={totalCards}
          icon={CreditCard}
          variant="card"
          subtitle="Total das faturas"
        />
        <SummaryCard
          title={accBalance !== null && accBalance !== balance ? "Saldo acumulado" : "Saldo"}
          value={accBalance ?? balance}
          icon={Wallet}
          variant="balance"
          subtitle={
            accBalance !== null && accBalance !== balance
              ? `Mês: ${balance >= 0 ? "+" : ""}${formatCurrency(balance)}`
              : balance >= 0 ? "Sobra do mês" : "Déficit do mês"
          }
        />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <a href="/lancamentos" className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors whitespace-nowrap">
          <Plus size={13} /> Novo lancamento
        </a>
        <a href="/gastos-mensais" className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
          <FileText size={13} /> Gastos do mes
        </a>
        <a href="/simulador" className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors whitespace-nowrap">
          <Calculator size={13} /> Simulador
        </a>
        <a href="/faturas" className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors whitespace-nowrap">
          <CreditCard size={13} /> Faturas
        </a>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Bar + Line Chart */}
        <div className="lg:col-span-2 card transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
              Receitas vs Despesas — {year}
            </h3>
            {/* Toggle Tudo / Saldo */}
            <div className="flex bg-slate-100 dark:bg-slate-700/60 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setShowOnlySaldo(false)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  !showOnlySaldo
                    ? "bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >Tudo</button>
              <button
                onClick={() => setShowOnlySaldo(true)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  showOnlySaldo
                    ? "bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >Saldo</button>
            </div>
          </div>
          <div className="overflow-x-auto -mx-2 px-2">
          <ResponsiveContainer width="100%" height={220} minWidth={500}>
            <ComposedChart data={yearlyData} margin={{ top: 5, right: 45, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                domain={['auto', 'auto']} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                domain={['auto', 'auto']} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine yAxisId="right" y={0} stroke="#94a3b8" strokeDasharray="4 4" />
              {!showOnlySaldo && (
                <>
                  <Bar yAxisId="left" dataKey="receitas" name="Receitas" fill="#10b981" stackId="r" radius={[4, 4, 0, 0]} />
                  {catKeys.map(({ key, color }) => (
                    <Bar
                      key={key}
                      yAxisId="left"
                      dataKey={key}
                      name={key.charAt(0).toUpperCase() + key.slice(1)}
                      fill={color}
                      stackId="d"
                      radius={[0, 0, 0, 0]}
                    />
                  ))}
                  <Bar yAxisId="left" dataKey="cartoes" name="Cartões" fill="#ef4444" stackId="d" radius={[4, 4, 0, 0]} />
                </>
              )}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="saldoAcumulado"
                name="Saldo Acumulado"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: "#8b5cf6", r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="card transition-colors">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 text-sm">
            Distribuição de Gastos
          </h3>
          {totalExpenses > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-slate-400 dark:text-slate-500 text-sm">Sem dados</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cards Summary */}
        <div className="card transition-colors">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 text-sm flex items-center gap-2">
            <CreditCard size={15} className="text-slate-500 dark:text-slate-400" />
            Situação dos Cartões
          </h3>
          {cardsPaid.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-sm py-4 text-center">
              Nenhum lançamento neste mês
            </p>
          ) : (
            <div className="space-y-2.5">
              {cardsPaid.map((card) => (
                <div key={card.id}
                  className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: card.color }} />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{card.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Vence dia {card.due_day}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatCurrency(card.total)}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      card.paid
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                    }`}>
                      {card.paid ? "Pago" : "Pendente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progress Bars / Resumo */}
        <div className="card transition-colors">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 text-sm flex items-center gap-2">
            <Calendar size={15} className="text-slate-500 dark:text-slate-400" />
            Resumo Financeiro
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Receitas</span>
                <span className="text-xs font-medium text-emerald-600">{formatCurrency(totalIncome)}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                <div className="h-2 bg-emerald-500 rounded-full" style={{ width: "100%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Contas</span>
                <span className="text-xs font-medium text-primary-600">{formatCurrency(totalBills)}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                <div
                  className="h-2 bg-primary-500 rounded-full"
                  style={{ width: `${totalIncome > 0 ? Math.min((totalBills / totalIncome) * 100, 100) : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Faturas Cartões</span>
                <span className="text-xs font-medium text-amber-600">{formatCurrency(totalCards)}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                <div
                  className="h-2 bg-amber-500 rounded-full"
                  style={{ width: `${totalIncome > 0 ? Math.min((totalCards / totalIncome) * 100, 100) : 0}%` }}
                />
              </div>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Saldo do Mês</span>
                <span className={`text-base font-bold ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {balance >= 0 ? (
                    <ArrowUpRight size={15} className="inline mr-0.5" />
                  ) : (
                    <ArrowDownRight size={15} className="inline mr-0.5" />
                  )}
                  {formatCurrency(balance)}
                </span>
              </div>
              {accBalance !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Saldo Acumulado</span>
                  <span className={`text-lg font-bold ${accBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {accBalance >= 0 ? (
                      <ArrowUpRight size={16} className="inline mr-1" />
                    ) : (
                      <ArrowDownRight size={16} className="inline mr-1" />
                    )}
                    {formatCurrency(accBalance)}
                  </span>
                </div>
              )}
              {totalIncome > 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {((totalExpenses / totalIncome) * 100).toFixed(1)}% da renda comprometida
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
