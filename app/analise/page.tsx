"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthSelector } from "@/components/ui/MonthSelector";
import {
  getFixedBills, getCategories, getCardTransactions,
  getMonthlyBillPayments, getMonthlyIncomes, getIncomeSources,
  getCardTransactionsByYear,
} from "@/lib/queries";
import type { MonthlyBillPayment, CardTransaction } from "@/types";
import { formatCurrency, getCurrentMonth, getMonthName, filterRegularBills, getAccConfig, computeInstallment } from "@/lib/utils";
import { MONTH_SHORT, MONTHS } from "@/types";
import type { Category, FixedBill } from "@/types";
import { ChartTooltip } from "@/components/ui/ChartTooltip";

const FALLBACK_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
];

function colorOf(cats: Category[], name: string, idx: number): string {
  return cats.find(c => c.name === name)?.color ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

/** Agrupa transações de cartão por categoria (valor líquido: despesas = positivo) */
function groupCardByCat(txs: CardTransaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  txs.forEach(tx => {
    const key = tx.category ?? "Sem categoria";
    map[key] = (map[key] ?? 0) - tx.amount; // expense (negativo) → positivo
  });
  // Remove créditos líquidos (result < 0)
  Object.keys(map).forEach(k => { if (map[k] <= 0) delete map[k]; });
  return map;
}

export default function AnalisePage() {
  const { month: cm, year: cy } = getCurrentMonth();
  const [month, setMonth] = useState(cm);
  const [year, setYear]   = useState(cy);
  const [loading, setLoading] = useState(true);

  const [categories,      setCategories]      = useState<Category[]>([]);
  const [fixedBills,      setFixedBills]       = useState<FixedBill[]>([]);
  const [monthlyBillAmt,  setMonthlyBillAmt]   = useState<Record<string, number>>({});
  const [cardByCat,       setCardByCat]        = useState<Record<string, number>>({});
  const [annualCardByCat, setAnnualCardByCat]  = useState<Record<number, Record<string, number>>>({});
  const [incomeTotal,     setIncomeTotal]      = useState(0);
  const [prevBalance,     setPrevBalance]      = useState(0);

  useEffect(() => { loadData(); }, [month, year]);

  async function loadData() {
    setLoading(true);
    try {
      const [cats, bills, payments, txs, sources, incomes, annualTxs] = await Promise.all([
        getCategories(),
        getFixedBills(),
        getMonthlyBillPayments(month, year),
        getCardTransactions(month, year),
        getIncomeSources(month, year),
        getMonthlyIncomes(month, year),
        getCardTransactionsByYear(year),    // query única para o gráfico anual
      ]);

      setCategories(cats);
      const regular = filterRegularBills(bills);
      setFixedBills(regular);

      // Valor efetivo de cada conta no mês
      const billAmts: Record<string, number> = {};
      regular.forEach(b => {
        const p = payments.find(p => p.bill_id === b.id);
        billAmts[b.id] = p?.amount ?? b.amount;
      });
      setMonthlyBillAmt(billAmts);

      // Transações do mês agrupadas por categoria
      setCardByCat(groupCardByCat(txs));

      // Transações anuais agrupadas por mês→categoria
      const annual: Record<number, Record<string, number>> = {};
      for (let m = 1; m <= 12; m++) annual[m] = {};
      annualTxs.forEach(tx => {
        const m = tx.month;
        if (!annual[m]) annual[m] = {};
        const key = tx.category ?? "Sem categoria";
        annual[m][key] = (annual[m][key] ?? 0) - tx.amount;
      });
      // Remove negativos (créditos)
      Object.values(annual).forEach(mo => {
        Object.keys(mo).forEach(k => { if (mo[k] <= 0) delete mo[k]; });
      });
      setAnnualCardByCat(annual);

      // Total de receitas do mês
      const inc = sources.reduce((s, src) => {
        const mi = incomes.find(i => i.source_id === src.id);
        return s + (mi?.amount ?? src.base_amount);
      }, 0);
      setIncomeTotal(inc);

      // Saldo acumulado
      const cfg = getAccConfig();
      const baseRecurring = sources.filter(s => s.is_recurring !== false).reduce((s, src) => s + src.base_amount, 0);
      let monthsToLoad: number[];
      if (year === cfg.startYear) {
        monthsToLoad = month > cfg.startMonth ? Array.from({ length: month - cfg.startMonth }, (_, i) => cfg.startMonth + i) : [];
      } else if (year > cfg.startYear) {
        monthsToLoad = month > 1 ? Array.from({ length: month - 1 }, (_, i) => i + 1) : [];
      } else {
        monthsToLoad = [];
      }

      if (monthsToLoad.length === 0) {
        setPrevBalance(cfg.saldoInicial);
      } else {
        const pastBalances = await Promise.all(
          monthsToLoad.map(async (m) => {
            const [incPast, billsPast, txsPast] = await Promise.all([
              getMonthlyIncomes(m, year),
              getMonthlyBillPayments(m, year),
              getCardTransactions(m, year),
            ]);
            const incPastTotal = incPast.length > 0 ? incPast.reduce((s, i) => s + i.amount, 0) : baseRecurring;
            const activeBills = regular.filter(bill => {
              if (!bill.installment_total) return true;
              if (bill.installment_start_month == null || bill.installment_start_year == null) return true;
              return computeInstallment(bill, m, year) !== null;
            });
            const billIdsPast = billsPast.map((b: MonthlyBillPayment) => b.bill_id);
            const missing = activeBills.filter(b => !billIdsPast.includes(b.id));
            const billsTotal = [
              ...billsPast.filter((b: MonthlyBillPayment) => activeBills.some(ab => ab.id === b.bill_id))
                .map((b: MonthlyBillPayment) => b.amount ?? activeBills.find(ab => ab.id === b.bill_id)?.amount ?? 0),
              ...missing.map(b => b.amount),
            ].reduce((s, v) => s + v, 0);
            const cardsPast = txsPast.reduce((s, t) => s - t.amount, 0);
            return incPastTotal - billsTotal - cardsPast;
          })
        );
        setPrevBalance(cfg.saldoInicial + pastBalances.reduce((s, v) => s + v, 0));
      }
    } finally {
      setLoading(false);
    }
  }

  // ─── Dados derivados ─────────────────────────────────────────────────────────

  const visibleFixedBills = fixedBills.filter(b => {
    if (!b.installment_total) return true;
    if (b.installment_start_month == null || b.installment_start_year == null) return true;
    return computeInstallment(b, month, year) !== null;
  });

  // Mapa de gastos por categoria: contas + transações de cartão mescladas
  const categoryMap: Record<string, number> = {};
  visibleFixedBills.forEach(b => {
    const cat = b.category || "outros";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + (monthlyBillAmt[b.id] ?? b.amount);
  });
  Object.entries(cardByCat).forEach(([cat, amount]) => {
    categoryMap[cat] = (categoryMap[cat] ?? 0) + amount;
  });

  const pieData = Object.entries(categoryMap)
    .filter(([, v]) => v > 0)
    .map(([name, value], idx) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      rawName: name,
      value,
      color: colorOf(categories, name, idx),
    }))
    .sort((a, b) => b.value - a.value);

  const totalExpenses = pieData.reduce((s, d) => s + d.value, 0);
  const cardTotal     = Object.values(cardByCat).reduce((s, v) => s + v, 0);
  const monthBalance  = incomeTotal - totalExpenses;
  const accBalance    = prevBalance + monthBalance;

  // Chaves de categoria para o gráfico anual (contas + todas categorias do cartão)
  const allCatKeys = Array.from(new Set([
    ...fixedBills.map(b => b.category || "outros"),
    ...Object.values(annualCardByCat).flatMap(m => Object.keys(m)),
  ]));

  const annualData = MONTH_SHORT.map((label, i) => {
    const m = i + 1;
    const row: Record<string, number | string> = { mes: label };
    allCatKeys.forEach(cat => {
      // Contas fixas para o mês
      const billAmt = fixedBills
        .filter(b => {
          if ((b.category || "outros") !== cat) return false;
          if (!b.installment_total) return true;
          if (b.installment_start_month == null || b.installment_start_year == null) return true;
          return computeInstallment(b, m, year) !== null;
        })
        .reduce((s, b) => s + b.amount, 0);
      // Cartão para o mês (por categoria)
      const cardAmt = annualCardByCat[m]?.[cat] ?? 0;
      row[cat] = billAmt + cardAmt;
    });
    return row;
  });

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 md:p-6 min-h-screen">
      <PageHeader title="Análise por Categoria" subtitle="Distribuição de gastos mensal e anual">
        <MonthSelector month={month} year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── KPIs — 2×2 mobile ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3 transition-colors">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Receitas</p>
              <p className="text-base font-bold text-emerald-600">{formatCurrency(incomeTotal)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3 transition-colors">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Total Gastos</p>
              <p className="text-base font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3 transition-colors">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Cartões</p>
              <p className="text-base font-bold text-violet-600">{formatCurrency(cardTotal)}</p>
              <p className="text-xs text-slate-400">{totalExpenses > 0 ? `${((cardTotal / totalExpenses) * 100).toFixed(0)}% dos gastos` : "—"}</p>
            </div>
            <div className={`rounded-xl p-3 border transition-colors ${
              accBalance >= 0
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30"
                : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30"
            }`}>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Saldo Acum.</p>
              <p className={`text-base font-bold ${accBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {accBalance >= 0 ? "+" : ""}{formatCurrency(accBalance)}
              </p>
              <p className="text-xs text-slate-400">Mês: {monthBalance >= 0 ? "+" : ""}{formatCurrency(monthBalance)}</p>
            </div>
          </div>

          {/* ── Pizza + Detalhamento ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Pizza */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-4 transition-colors">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Gastos por Categoria — {getMonthName(month)}/{year}
              </h2>
              {pieData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">Nenhum gasto registrado</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                      paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip showDot />} />
                    <Legend formatter={(value) => <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Detalhamento por categoria */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-4 transition-colors">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Detalhamento — {getMonthName(month)}/{year}
              </h2>
              <div className="space-y-2">
                {pieData.map(entry => (
                  <div key={entry.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm text-slate-700 dark:text-slate-200 capitalize">{entry.name}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(entry.value)}</span>
                        <span className="text-xs text-slate-400 ml-1.5">
                          {totalExpenses > 0 ? `${((entry.value / totalExpenses) * 100).toFixed(1)}%` : "0%"}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all"
                        style={{ width: `${totalExpenses > 0 ? (entry.value / totalExpenses) * 100 : 0}%`, backgroundColor: entry.color }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Itens por categoria */}
              {pieData.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Detalhes</p>
                  {pieData.map((entry, idx) => {
                    const bills = visibleFixedBills.filter(b => (b.category || "outros") === entry.rawName);
                    const cardAmt = cardByCat[entry.rawName];
                    if (bills.length === 0 && !cardAmt) return null;
                    return (
                      <div key={entry.rawName} className="mb-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">{entry.name}</span>
                        </div>
                        {bills.map(b => (
                          <div key={b.id} className="flex justify-between text-xs text-slate-500 dark:text-slate-400 pl-3.5 py-0.5">
                            <span className="truncate">{b.name}</span>
                            <span className="shrink-0 ml-2">{formatCurrency(monthlyBillAmt[b.id] ?? b.amount)}</span>
                          </div>
                        ))}
                        {cardAmt && (
                          <div className="flex justify-between text-xs text-slate-400 pl-3.5 py-0.5">
                            <span className="italic">Cartão</span>
                            <span className="shrink-0 ml-2">{formatCurrency(cardAmt)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Barras anuais ──────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-4 transition-colors">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Gastos Anuais por Categoria — {year}
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={annualData} barSize={16} barGap={2} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={32} />
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={(value) => <span className="text-xs text-slate-600 dark:text-slate-300 capitalize">{value}</span>} />
                {allCatKeys.map((key, idx) => (
                  <Bar key={key} dataKey={key}
                    name={key.charAt(0).toUpperCase() + key.slice(1)}
                    fill={colorOf(categories, key, idx)}
                    stackId="a"
                    radius={idx === allCatKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}
    </div>
  );
}
