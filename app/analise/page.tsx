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
  getCardTotalsByMonth,
} from "@/lib/queries";
import { formatCurrency, getCurrentMonth, getMonthName } from "@/lib/utils";
import { MONTH_SHORT } from "@/types";
import type { Category, FixedBill } from "@/types";

// ─── Cores padrão quando a categoria não tem cor definida ─────────────────────
const FALLBACK_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
];

function colorOf(cats: Category[], name: string, idx: number): string {
  return cats.find(c => c.name === name)?.color ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      {label && <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}</p>}
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color ?? entry.fill }} />
            <span className="text-slate-600 dark:text-slate-300">{entry.name}</span>
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalisePage() {
  const { month: cm, year: cy } = getCurrentMonth();
  const [month, setMonth] = useState(cm);
  const [year, setYear]   = useState(cy);
  const [loading, setLoading] = useState(true);

  const [categories,    setCategories]    = useState<Category[]>([]);
  const [fixedBills,    setFixedBills]    = useState<FixedBill[]>([]);
  const [monthlyBillAmt, setMonthlyBillAmt] = useState<Record<string, number>>({});
  const [cardTotal,     setCardTotal]     = useState(0);
  const [incomeTotal,   setIncomeTotal]   = useState(0);
  const [annualCardTotals, setAnnualCardTotals] = useState<Record<number, number>>({});

  useEffect(() => { loadData(); }, [month, year]);

  async function loadData() {
    setLoading(true);
    try {
      const [cats, bills, payments, txs, sources, incomes, annualCards] = await Promise.all([
        getCategories(),
        getFixedBills(),
        getMonthlyBillPayments(month, year),
        getCardTransactions(month, year),
        getIncomeSources(month, year),
        getMonthlyIncomes(month, year),
        getCardTotalsByMonth(year),
      ]);

      setCategories(cats);
      setFixedBills(bills.filter(b => !b.is_tithe));

      // Valor efetivo de cada conta no mês (payment sobrescreve base)
      const billAmts: Record<string, number> = {};
      bills.filter(b => !b.is_tithe).forEach(b => {
        const p = payments.find(p => p.bill_id === b.id);
        billAmts[b.id] = p?.amount ?? b.amount;
      });
      setMonthlyBillAmt(billAmts);

      const cardTot = txs.reduce((s, t) => s + Math.abs(t.amount), 0);
      setCardTotal(cardTot);

      const inc = sources.reduce((s, src) => {
        const mi = incomes.find(i => i.source_id === src.id);
        return s + (mi?.amount ?? src.base_amount);
      }, 0);
      setIncomeTotal(inc);

      setAnnualCardTotals(annualCards);
    } finally {
      setLoading(false);
    }
  }

  // ─── Dados para o gráfico de pizza mensal ────────────────────────────────────

  // Agrupa contas por categoria
  const categoryMap: Record<string, number> = {};
  fixedBills.forEach(b => {
    const cat = b.category || "outros";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + (monthlyBillAmt[b.id] ?? b.amount);
  });
  if (cardTotal > 0) categoryMap["Cartões"] = cardTotal;

  const pieData = Object.entries(categoryMap)
    .filter(([, v]) => v > 0)
    .map(([name, value], idx) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: name === "Cartões" ? "#8b5cf6" : colorOf(categories, name, idx),
    }))
    .sort((a, b) => b.value - a.value);

  const totalExpenses = pieData.reduce((s, d) => s + d.value, 0);

  // ─── Dados para o gráfico de barras anual ─────────────────────────────────

  // Contas: valores base (fixos) agrupados por categoria
  const catNames = Array.from(new Set(fixedBills.map(b => b.category || "outros")));

  const annualData = MONTH_SHORT.map((label, i) => {
    const m = i + 1;
    const row: Record<string, number | string> = { mes: label };
    catNames.forEach(cat => {
      row[cat] = fixedBills
        .filter(b => (b.category || "outros") === cat)
        .reduce((s, b) => s + b.amount, 0);
    });
    row["Cartões"] = annualCardTotals[m] ?? 0;
    return row;
  });

  const barKeys = [...catNames, "Cartões"];

  return (
    <div className="p-6 min-h-screen">
      <PageHeader title="Análise por Categoria" subtitle="Distribuição de gastos mensal e anual">
        <MonthSelector month={month} year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Resumo do mês ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3.5 transition-colors">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Receitas</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(incomeTotal)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3.5 transition-colors">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Gastos</p>
              <p className="text-lg font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3.5 transition-colors">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cartões</p>
              <p className="text-lg font-bold text-violet-600">{formatCurrency(cardTotal)}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {totalExpenses > 0 ? `${((cardTotal / totalExpenses) * 100).toFixed(0)}% dos gastos` : "—"}
              </p>
            </div>
            <div className={`rounded-xl p-3.5 border transition-colors ${
              incomeTotal - totalExpenses >= 0
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30"
                : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30"
            }`}>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Saldo</p>
              <p className={`text-lg font-bold ${incomeTotal - totalExpenses >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatCurrency(incomeTotal - totalExpenses)}
              </p>
            </div>
          </div>

          {/* ── Linha superior: Pizza + Lista de categorias ────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

            {/* Pizza — gastos do mês */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-5 transition-colors">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                Gastos por Categoria — {getMonthName(month)}/{year}
              </h2>
              {pieData.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-12">
                  Nenhum gasto registrado
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData} cx="50%" cy="50%"
                      innerRadius={60} outerRadius={100}
                      paddingAngle={2} dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Lista detalhada por categoria */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-5 transition-colors">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                Detalhamento — {getMonthName(month)}/{year}
              </h2>
              <div className="space-y-2">
                {pieData.map(entry => (
                  <div key={entry.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm text-slate-700 dark:text-slate-200">{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {formatCurrency(entry.value)}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                          {totalExpenses > 0 ? `${((entry.value / totalExpenses) * 100).toFixed(1)}%` : "0%"}
                        </span>
                      </div>
                    </div>
                    {/* Mini barra de progresso */}
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${totalExpenses > 0 ? (entry.value / totalExpenses) * 100 : 0}%`,
                          backgroundColor: entry.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Contas por categoria — mini lista */}
              {pieData.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Contas por categoria
                  </p>
                  {Object.entries(categoryMap)
                    .filter(([k]) => k !== "Cartões")
                    .map(([cat, total], idx) => {
                      const bills = fixedBills.filter(b => (b.category || "outros") === cat);
                      return (
                        <div key={cat} className="mb-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colorOf(categories, cat, idx) }} />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">{cat}</span>
                          </div>
                          {bills.map(b => (
                            <div key={b.id} className="flex justify-between text-xs text-slate-500 dark:text-slate-400 pl-3.5 py-0.5">
                              <span className="truncate">{b.name}</span>
                              <span>{formatCurrency(monthlyBillAmt[b.id] ?? b.amount)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  }
                </div>
              )}
            </div>
          </div>

          {/* ── Barras anuais por categoria ───────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-5 transition-colors">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
              Gastos Anuais por Categoria — {year}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={annualData} barSize={18} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-slate-600 dark:text-slate-300 capitalize">{value}</span>
                  )}
                />
                {barKeys.map((key, idx) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={key.charAt(0).toUpperCase() + key.slice(1)}
                    fill={key === "Cartões" ? "#8b5cf6" : colorOf(categories, key, idx)}
                    stackId="a"
                    radius={idx === barKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
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
