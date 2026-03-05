"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, CreditCard,
  ArrowUpRight, ArrowDownRight, Calendar
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
  getMonthlyCardPayments, getIncomeSources,
} from "@/lib/queries";
import { formatCurrency, getMonthName, getCurrentMonth, getAccConfig, computeInstallment } from "@/lib/utils";
import { MONTH_SHORT } from "@/types";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

const PIE_COLORS = {
  essencial: "#6366f1",
  outros: "#f59e0b",
  cartoes: "#ef4444",
};

export default function DashboardPage() {
  const { month: cm, year: cy } = getCurrentMonth();
  const [month, setMonth] = useState(cm);
  const [year, setYear] = useState(cy);
  const [loading, setLoading] = useState(true);

  const [totalIncome, setTotalIncome] = useState(0);
  const [totalBills, setTotalBills] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [balance, setBalance] = useState(0);
  const [yearlyData, setYearlyData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [cardsPaid, setCardsPaid] = useState<any[]>([]);
  const [billsPaid, setBillsPaid] = useState<any[]>([]);
  const [accBalance, setAccBalance] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [month, year]);

  async function loadData() {
    setLoading(true);
    try {
      // Carrega tudo de uma vez — incluindo fontes de renda para o fallback recorrente
      const [incomes, bills, txs, allBills, cards, cardPayments, incomeSrcs] = await Promise.all([
        getMonthlyIncomes(month, year),
        getMonthlyBillPayments(month, year),
        getCardTransactions(month, year),
        getFixedBills(),
        getCreditCards(),
        getMonthlyCardPayments(month, year),
        getIncomeSources(), // todas as fontes — filtragem por avulsa feita inline
      ]);

      // incomeSrcs = todas as fontes ativas (sem filtro de mês);
      // a filtragem por avulsa do mês é feita inline abaixo

      // Receita do mês: recorrentes sempre + avulsas só deste mês/ano, com fallback base_amount
      const inc = incomeSrcs.reduce((s, src) => {
        const mi = incomes.find(i => i.source_id === src.id);
        if (src.is_recurring === false) {
          if (src.one_time_month !== month || src.one_time_year !== year) return s;
        }
        return s + (mi?.amount ?? src.base_amount);
      }, 0);

      // Separa dízimo das contas regulares
      const titheBillItem = allBills.find(b => b.is_tithe);
      const regularAllBills = allBills.filter(b => !b.is_tithe);

      // Filtra installment bills fora do intervalo ativo
      const visibleBills = regularAllBills.filter(bill => {
        if (!bill.installment_total) return true;
        if (bill.installment_start_month == null || bill.installment_start_year == null) return true;
        return computeInstallment(bill, month, year) !== null;
      });

      // Merge: pagamentos do mês + contas sem registro (apenas visíveis)
      const billIds = bills.map(b => b.bill_id);
      const missingBills = visibleBills.filter(b => !billIds.includes(b.id));
      const regularItems: { amount: number; category: string }[] = [
        ...bills
          .filter(b => visibleBills.some(vb => vb.id === b.bill_id))
          .map(b => ({ amount: b.amount ?? b.fixed_bills?.amount ?? 0, category: b.fixed_bills?.category ?? "outros" })),
        ...missingBills.map(b => ({ amount: b.amount, category: b.category })),
      ];

      // Dízimo: usa valor do pagamento se existir, senão computa 10% da renda
      const tithePayment = titheBillItem ? bills.find(b => b.bill_id === titheBillItem.id) : null;
      const titheAmt = tithePayment?.amount ?? (titheBillItem ? inc * 0.1 : 0);
      const titheCategory = titheBillItem?.category ?? "essencial";
      const allBillsThisMonth = titheBillItem
        ? [...regularItems, { amount: titheAmt, category: titheCategory }]
        : regularItems;

      const essencial = allBillsThisMonth.filter(b => b.category === "essencial").reduce((s, b) => s + b.amount, 0);
      const outros = allBillsThisMonth.filter(b => b.category === "outros").reduce((s, b) => s + b.amount, 0);
      const billsTotal = essencial + outros;

      // Cards
      const cardsTotal = txs.reduce((s, t) => s + Math.abs(t.amount), 0);

      setTotalIncome(inc);
      setTotalBills(billsTotal);
      setTotalCards(cardsTotal);
      setBalance(inc - billsTotal - cardsTotal);

      // Pie chart data
      setPieData([
        { name: "Essenciais", value: essencial, color: PIE_COLORS.essencial },
        { name: "Outros", value: outros, color: PIE_COLORS.outros },
        { name: "Cartões", value: cardsTotal, color: PIE_COLORS.cartoes },
      ]);

      // Cards summary
      const cardSummary = cards.map(card => {
        const cardTxs = txs.filter(t => t.card_id === card.id);
        const total = cardTxs.reduce((s, t) => s + Math.abs(t.amount), 0);
        const payment = cardPayments.find(p => p.card_id === card.id);
        return { ...card, total, paid: payment?.paid ?? false };
      }).filter(c => c.total > 0);
      setCardsPaid(cardSummary);

      // Bills paid summary
      const billSummary = allBills.slice(0, 5).map(bill => {
        const payment = bills.find(b => b.bill_id === bill.id);
        return { ...bill, paid: payment?.paid ?? false, paidAmount: payment?.amount ?? bill.amount };
      });
      setBillsPaid(billSummary);

      // Gráfico anual — aplica mesma lógica: installment filter + dízimo dinâmico
      const yearlyPromises = Array.from({ length: 12 }, async (_, i) => {
        const m = i + 1;
        const [inc2, billPay, txs2] = await Promise.all([
          getMonthlyIncomes(m, year),
          getMonthlyBillPayments(m, year),
          getCardTransactions(m, year),
        ]);
        // Per-source: recorrentes sempre + avulsas só do mês m, com fallback base_amount
        const income2 = incomeSrcs.reduce((s, src) => {
          const mi = inc2.find(i => i.source_id === src.id);
          if (src.is_recurring === false) {
            if (src.one_time_month !== m || src.one_time_year !== year) return s;
          }
          return s + (mi?.amount ?? src.base_amount);
        }, 0);

        // Filtra installments ativos para o mês m
        const visible2 = regularAllBills.filter(bill => {
          if (!bill.installment_total) return true;
          if (bill.installment_start_month == null || bill.installment_start_year == null) return true;
          return computeInstallment(bill, m, year) !== null;
        });
        const billIds2 = billPay.map(b => b.bill_id);
        const missing2 = visible2.filter(b => !billIds2.includes(b.id));

        // Dízimo anual: usa pagamento se existir, senão 10% da renda do mês
        const tithePay2 = titheBillItem ? billPay.find(b => b.bill_id === titheBillItem.id) : null;
        const titheAmt2 = tithePay2?.amount ?? (titheBillItem ? income2 * 0.1 : 0);
        const titheCategory2 = titheBillItem?.category ?? "essencial";

        // Agrupa despesas por categoria para o gráfico empilhado
        const billsWithCats2 = [
          ...billPay
            .filter(b => visible2.some(vb => vb.id === b.bill_id))
            .map(b => ({ amount: b.amount ?? b.fixed_bills?.amount ?? 0, category: b.fixed_bills?.category ?? "outros" })),
          ...missing2.map(b => ({ amount: b.amount, category: b.category })),
        ];
        const essenciais2 = billsWithCats2.filter(b => b.category === "essencial").reduce((s, b) => s + b.amount, 0)
          + (titheCategory2 === "essencial" ? titheAmt2 : 0);
        const outros2 = billsWithCats2.filter(b => b.category !== "essencial").reduce((s, b) => s + b.amount, 0)
          + (titheCategory2 !== "essencial" ? titheAmt2 : 0);
        const cards2 = txs2.reduce((s, t) => s + Math.abs(t.amount), 0);
        const despesas2 = essenciais2 + outros2 + cards2;
        return { name: MONTH_SHORT[i], receitas: income2, essenciais: essenciais2, outros: outros2, cartoes: cards2, despesas: despesas2 };
      });
      const yd = await Promise.all(yearlyPromises);

      // Calcula saldo acumulado mês a mês (carry-over encadeado) com base na config
      const accCfg = getAccConfig();
      let running = accCfg.saldoInicial;
      const ydWithAcc = yd.map((d, i) => {
        const m = i + 1;
        // Ignora meses antes do início configurado (mesmo ano)
        if (accCfg.startYear === year && m < accCfg.startMonth) {
          return { ...d, saldoAcumulado: null as unknown as number };
        }
        running += d.receitas - d.despesas;
        return { ...d, saldoAcumulado: running };
      });
      setYearlyData(ydWithAcc);

      // Saldo acumulado do mês selecionado (para o card de resumo)
      const monthAcc = ydWithAcc[month - 1]?.saldoAcumulado ?? null;
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
          subtitle="Essenciais + outros"
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Bar Chart - 12 months */}
        <div className="xl:col-span-2 card transition-colors">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 text-sm">
            Receitas vs Despesas — {year}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={yearlyData} margin={{ top: 5, right: 45, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine yAxisId="right" y={0} stroke="#94a3b8" strokeDasharray="4 4" />
              <Bar yAxisId="left" dataKey="receitas" name="Receitas" fill="#10b981" stackId="r" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="essenciais" name="Essenciais" fill="#6366f1" stackId="d" radius={[0, 0, 0, 0]} />
              <Bar yAxisId="left" dataKey="outros" name="Outros" fill="#f59e0b" stackId="d" radius={[0, 0, 0, 0]} />
              <Bar yAxisId="left" dataKey="cartoes" name="Cartões" fill="#ef4444" stackId="d" radius={[4, 4, 0, 0]} />
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
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: card.color }}
                    />
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

        {/* Progress Bars */}
        <div className="card transition-colors">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 text-sm flex items-center gap-2">
            <Calendar size={15} className="text-slate-500 dark:text-slate-400" />
            Resumo Financeiro
          </h3>
          <div className="space-y-3">
            {/* Income progress */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Receitas</span>
                <span className="text-xs font-medium text-emerald-600">{formatCurrency(totalIncome)}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                <div className="h-2 bg-emerald-500 rounded-full" style={{ width: "100%" }} />
              </div>
            </div>

            {/* Bills progress */}
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

            {/* Cards progress */}
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

            {/* Balance */}
            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-700/50">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Saldo Final</span>
                <span className={`text-lg font-bold ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {balance >= 0 ? (
                    <ArrowUpRight size={16} className="inline mr-1" />
                  ) : (
                    <ArrowDownRight size={16} className="inline mr-1" />
                  )}
                  {formatCurrency(Math.abs(balance))}
                </span>
              </div>
              {totalIncome > 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
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
