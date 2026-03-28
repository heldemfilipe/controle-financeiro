"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthSelector } from "@/components/ui/MonthSelector";
import {
  getFixedBills, getCategories, getCardTransactions,
  getMonthlyBillPayments, getMonthlyIncomes, getIncomeSources,
} from "@/lib/queries";
import { computePrevBalance } from "@/lib/balance";
import type { MonthlyBillPayment, CardTransaction } from "@/types";
import { formatCurrency, getCurrentMonth, getMonthName, filterRegularBills, getAccConfig, computeInstallment } from "@/lib/utils";
import type { Category, FixedBill } from "@/types";

const FALLBACK_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
];

function colorOf(cats: Category[], name: string, idx: number): string {
  return cats.find(c => c.name === name)?.color ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function groupCardByCat(txs: CardTransaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  txs.forEach(tx => {
    const key = tx.category ?? "Sem categoria";
    map[key] = (map[key] ?? 0) - tx.amount;
  });
  Object.keys(map).forEach(k => { if (map[k] <= 0) delete map[k]; });
  return map;
}

export default function AnalisePage() {
  const { month: cm, year: cy } = getCurrentMonth();
  const [month, setMonth] = useState(cm);
  const [year, setYear]   = useState(cy);
  const [loading, setLoading] = useState(true);

  const [categories,     setCategories]    = useState<Category[]>([]);
  const [fixedBills,     setFixedBills]     = useState<FixedBill[]>([]);
  const [monthlyBillAmt, setMonthlyBillAmt] = useState<Record<string, number>>({});
  const [cardByCat,      setCardByCat]      = useState<Record<string, number>>({});
  const [incomeTotal,    setIncomeTotal]    = useState(0);
  const [prevBalance,    setPrevBalance]    = useState(0);

  useEffect(() => { loadData(); }, [month, year]);

  async function loadData() {
    setLoading(true);
    try {
      const [cats, bills, payments, txs, sources, incomes] = await Promise.all([
        getCategories(),
        getFixedBills(),
        getMonthlyBillPayments(month, year),
        getCardTransactions(month, year),
        getIncomeSources(month, year),
        getMonthlyIncomes(month, year),
      ]);

      setCategories(cats);
      const regular = filterRegularBills(bills);
      setFixedBills(regular);

      const billAmts: Record<string, number> = {};
      regular.forEach(b => {
        const p = payments.find(p => p.bill_id === b.id);
        billAmts[b.id] = p?.amount ?? b.amount;
      });
      setMonthlyBillAmt(billAmts);
      setCardByCat(groupCardByCat(txs));

      const inc = sources.reduce((s, src) => {
        const mi = incomes.find(i => i.source_id === src.id);
        return s + (mi?.amount ?? src.base_amount);
      }, 0);
      setIncomeTotal(inc);

      // Saldo acumulado anterior (usa módulo centralizado com suporte a overrides)
      const prev = await computePrevBalance(month, year);
      setPrevBalance(prev);
    } finally {
      setLoading(false);
    }
  }

  // ─── Dados derivados ──────────────────────────────────────────────────────────

  const visibleFixedBills = fixedBills.filter(b => {
    if (!b.installment_total) return true;
    if (b.installment_start_month == null || b.installment_start_year == null) return true;
    return computeInstallment(b, month, year) !== null;
  });

  const categoryMap: Record<string, number> = {};
  visibleFixedBills.forEach(b => {
    const cat = b.category || "outros";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + (monthlyBillAmt[b.id] ?? b.amount);
  });
  Object.entries(cardByCat).forEach(([cat, amount]) => {
    categoryMap[cat] = (categoryMap[cat] ?? 0) + amount;
  });

  const catList = Object.entries(categoryMap)
    .filter(([, v]) => v > 0)
    .map(([name, value], idx) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      rawName: name,
      value,
      color: colorOf(categories, name, idx),
    }))
    .sort((a, b) => b.value - a.value);

  const totalExpenses = catList.reduce((s, d) => s + d.value, 0);
  const cardTotal     = Object.values(cardByCat).reduce((s, v) => s + v, 0);
  const monthBalance  = incomeTotal - totalExpenses;
  const accBalance    = prevBalance + monthBalance;

  return (
    <div className="p-3 md:p-6 min-h-screen">
      <PageHeader title="Análise por Categoria" subtitle={`${getMonthName(month)} ${year}`}>
        <MonthSelector month={month} year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── KPIs ─────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Receitas</p>
              <p className="text-base font-bold text-emerald-600">{formatCurrency(incomeTotal)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Total Gastos</p>
              <p className="text-base font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Cartões</p>
              <p className="text-base font-bold text-violet-600">{formatCurrency(cardTotal)}</p>
              <p className="text-xs text-slate-400">
                {totalExpenses > 0 ? `${((cardTotal / totalExpenses) * 100).toFixed(0)}% dos gastos` : "—"}
              </p>
            </div>
            <div className={`rounded-xl p-3 border ${
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

          {/* ── Lista de categorias ───────────────────────────────────────────── */}
          {catList.length === 0 ? (
            <div className="card text-center py-12 text-slate-400 text-sm">Nenhum gasto registrado</div>
          ) : (
            <div className="card">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                Gastos por Categoria — {getMonthName(month)} {year}
              </h2>
              <div className="space-y-4">
                {catList.map(entry => {
                  const pct = totalExpenses > 0 ? (entry.value / totalExpenses) * 100 : 0;
                  const bills = visibleFixedBills.filter(b => (b.category || "outros") === entry.rawName);
                  const cardAmt = cardByCat[entry.rawName];
                  return (
                    <div key={entry.rawName}>
                      {/* Nome + valor */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize truncate">
                            {entry.name}
                          </span>
                        </div>
                        <div className="shrink-0 ml-3 flex items-baseline gap-1.5">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {formatCurrency(entry.value)}
                          </span>
                          <span className="text-xs text-slate-400">{pct.toFixed(0)}%</span>
                        </div>
                      </div>

                      {/* Barra */}
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
                        <div className="h-2 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: entry.color }} />
                      </div>

                      {/* Itens compactos */}
                      {(bills.length > 0 || cardAmt) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-5">
                          {bills.map(b => (
                            <span key={b.id} className="text-xs text-slate-400 dark:text-slate-500">
                              {b.name} {formatCurrency(monthlyBillAmt[b.id] ?? b.amount)}
                            </span>
                          ))}
                          {cardAmt && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              Cartão {formatCurrency(cardAmt)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Rodapé */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>Total</span>
                <span>{formatCurrency(totalExpenses)}</span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
