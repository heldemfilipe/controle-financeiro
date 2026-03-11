"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, CreditCard,
  ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight,
  Trophy, AlertCircle, Download,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend, ReferenceLine,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import {
  getMonthlyIncomes, getMonthlyBillPayments,
  getCardTransactions, getFixedBills, getIncomeSources,
} from "@/lib/queries";
import { formatCurrency, getMonthName, computeInstallment } from "@/lib/utils";
import { MONTH_SHORT } from "@/types";

interface MonthData {
  month: number;
  name: string;
  receitas: number;
  essenciais: number;
  outros: number;
  cartoes: number;
  despesas: number;
  saldo: number;
  saldoAcumulado: number;
}

export default function GastosAnuaisPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadYear(); }, [year]);

  async function loadYear() {
    setLoading(true);
    try {
      const allBills = await getFixedBills();
      const sources  = await getIncomeSources();

      const rawMonths = await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
          const month = i + 1;
          const [incomes, billPays, txs] = await Promise.all([
            getMonthlyIncomes(month, year),
            getMonthlyBillPayments(month, year),
            getCardTransactions(month, year),
          ]);

          const receitas = sources.reduce((s, src) => {
            const mi = incomes.find(i => i.source_id === src.id);
            if (src.is_recurring === false) {
              if (src.one_time_month !== month || src.one_time_year !== year) return s;
              return s + (mi?.amount ?? src.base_amount);
            }
            return s + (mi?.amount ?? src.base_amount);
          }, 0);

          const paidBillIds  = billPays.map(b => b.bill_id);
          const missingBills = allBills.filter(b => {
            if (paidBillIds.includes(b.id)) return false;
            if (!b.installment_total) return true;
            if (b.installment_start_month == null || b.installment_start_year == null) return true;
            return computeInstallment(b, month, year) !== null;
          });
          const allMonthBills = [
            ...billPays.map(b => ({
              amount: b.amount ?? b.fixed_bills?.amount ?? 0,
              category: b.fixed_bills?.category ?? "outros",
            })),
            ...missingBills.map(b => ({ amount: b.amount, category: b.category })),
          ];
          const essenciais = allMonthBills.filter(b => b.category === "essencial").reduce((s, b) => s + b.amount, 0);
          const outros      = allMonthBills.filter(b => b.category !== "essencial").reduce((s, b) => s + b.amount, 0);
          const cartoes     = txs.reduce((s, t) => s - t.amount, 0);
          const despesas    = essenciais + outros + cartoes;

          return { month, name: MONTH_SHORT[i], receitas, essenciais, outros, cartoes, despesas, saldo: receitas - despesas, saldoAcumulado: 0 };
        })
      );

      let acc = 0;
      const months = rawMonths.map(m => { acc += m.saldo; return { ...m, saldoAcumulado: acc }; });
      setData(months);
    } finally {
      setLoading(false);
    }
  }

  const totalReceitas = data.reduce((s, d) => s + d.receitas, 0);
  const totalDespesas = data.reduce((s, d) => s + d.despesas, 0);
  const totalCartoes  = data.reduce((s, d) => s + d.cartoes, 0);
  const totalSaldo    = totalReceitas - totalDespesas;
  const avgReceitas   = totalReceitas / 12;
  const avgDespesas   = totalDespesas / 12;

  const monthsWithData = data.filter(d => d.receitas > 0 || d.despesas > 0);
  const melhorMes = monthsWithData.length > 0
    ? monthsWithData.reduce((best, d) => d.saldo > best.saldo ? d : best, monthsWithData[0])
    : null;
  const piorMes = monthsWithData.length > 0
    ? monthsWithData.reduce((worst, d) => d.saldo < worst.saldo ? d : worst, monthsWithData[0])
    : null;

  const now = new Date();

  return (
    <div className="p-3 md:p-6 min-h-screen">
      <PageHeader title="Gastos Anuais" subtitle="Visão completa do ano">
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const { exportFinanceiro } = await import("@/lib/exportExcel");
              await exportFinanceiro(year);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            title="Exportar dados do ano para Excel"
          >
            <Download size={13} /> Excel
          </button>
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-1 py-1 transition-colors">
            <button onClick={() => setYear(y => y - 1)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronLeft size={15} className="text-slate-600 dark:text-slate-300" />
            </button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[44px] text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronRight size={15} className="text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400">Carregando…</div>
      ) : (
        <>
          {/* ── KPIs ─────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-3 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Receitas {year}</p>
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalReceitas)}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Média {formatCurrency(avgReceitas)}/mês</p>
                </div>
                <TrendingUp size={16} className="text-emerald-400 shrink-0" />
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-xl p-3 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Despesas {year}</p>
                  <p className="text-base font-bold text-red-700 dark:text-red-400">{formatCurrency(totalDespesas)}</p>
                  <p className="text-xs text-red-600 mt-0.5">Média {formatCurrency(avgDespesas)}/mês</p>
                </div>
                <TrendingDown size={16} className="text-red-400 shrink-0" />
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl p-3 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Cartões {year}</p>
                  <p className="text-base font-bold text-amber-700 dark:text-amber-400">{formatCurrency(totalCartoes)}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Média {formatCurrency(totalCartoes / 12)}/mês</p>
                </div>
                <CreditCard size={16} className="text-amber-400 shrink-0" />
              </div>
            </div>
            <div className={`border rounded-xl p-3 transition-colors ${totalSaldo >= 0 ? "bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800/30" : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Saldo Anual</p>
                  <p className={`text-base font-bold ${totalSaldo >= 0 ? "text-primary-700 dark:text-primary-400" : "text-red-700 dark:text-red-400"}`}>{formatCurrency(totalSaldo)}</p>
                  <p className={`text-xs mt-0.5 ${totalSaldo >= 0 ? "text-primary-600" : "text-red-500"}`}>
                    {totalReceitas > 0 ? `${((totalDespesas / totalReceitas) * 100).toFixed(1)}% comprometido` : "—"}
                  </p>
                </div>
                <Wallet size={16} className={`shrink-0 ${totalSaldo >= 0 ? "text-primary-400" : "text-red-400"}`} />
              </div>
            </div>
          </div>

          {/* ── Melhor / Pior mês ────────────────────────────────────────────── */}
          {(melhorMes || piorMes) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {melhorMes && (
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-3 text-white">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Trophy size={13} className="text-emerald-200" />
                    <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wide">Melhor mês</span>
                  </div>
                  <p className="text-base font-bold">{getMonthName(melhorMes.month)}</p>
                  <p className="text-xs text-emerald-100">Saldo: {formatCurrency(melhorMes.saldo)}</p>
                </div>
              )}
              {piorMes && (
                <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl p-3 text-white">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <AlertCircle size={13} className="text-red-200" />
                    <span className="text-xs font-semibold text-red-100 uppercase tracking-wide">Mês mais pesado</span>
                  </div>
                  <p className="text-base font-bold">{getMonthName(piorMes.month)}</p>
                  <p className="text-xs text-red-100">Saldo: {formatCurrency(piorMes.saldo)} · Despesas: {formatCurrency(piorMes.despesas)}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Tabela Resumo Mensal ──────────────────────────────────────────── */}
          <div className="card mb-4 transition-colors overflow-hidden">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Resumo Mensal — {year}</h3>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700/50">
                    <th className="text-left py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Mês</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-emerald-600 uppercase tracking-wide">Receitas</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-primary-600 uppercase tracking-wide hidden sm:table-cell">Essenc.</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-amber-600 uppercase tracking-wide hidden sm:table-cell">Outros</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-red-500 uppercase tracking-wide hidden md:table-cell">Cartões</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Despesas</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Saldo</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-violet-600 uppercase tracking-wide hidden lg:table-cell">Acum.</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(row => {
                    const isCurrent = row.month === now.getMonth() + 1 && year === now.getFullYear();
                    const pct = row.receitas > 0 ? (row.despesas / row.receitas) * 100 : 0;
                    return (
                      <tr key={row.month}
                        className={`border-b border-slate-50 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${isCurrent ? "bg-primary-50/30 dark:bg-primary-900/10" : ""}`}
                      >
                        <td className="py-2 pr-2 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {getMonthName(row.month)}
                          {isCurrent && <span className="ml-1.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-1.5 py-0.5 rounded-full">atual</span>}
                        </td>
                        <td className="py-2 px-2 text-right font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {row.receitas > 0 ? formatCurrency(row.receitas) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="py-2 px-2 text-right text-primary-700 dark:text-primary-400 tabular-nums hidden sm:table-cell">{formatCurrency(row.essenciais)}</td>
                        <td className="py-2 px-2 text-right text-amber-700 dark:text-amber-400 tabular-nums hidden sm:table-cell">{formatCurrency(row.outros)}</td>
                        <td className="py-2 px-2 text-right text-red-600 tabular-nums hidden md:table-cell">
                          {row.cartoes > 0 ? formatCurrency(row.cartoes) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="py-2 px-2 text-right font-medium text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(row.despesas)}</td>
                        <td className="py-2 px-2 text-right font-bold tabular-nums">
                          <span className={`inline-flex items-center gap-0.5 ${row.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {row.saldo >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                            {formatCurrency(row.saldo)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-semibold tabular-nums hidden lg:table-cell">
                          <span className={row.saldoAcumulado >= 0 ? "text-violet-600 dark:text-violet-400" : "text-red-600"}>
                            {formatCurrency(row.saldoAcumulado)}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {row.receitas > 0 ? (
                            <span className={`text-xs font-medium ${pct > 90 ? "text-red-500" : pct > 70 ? "text-amber-500" : "text-emerald-600"}`}>
                              {pct.toFixed(0)}%
                            </span>
                          ) : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
                    <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">TOTAL</td>
                    <td className="py-2.5 px-2 text-right font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurrency(totalReceitas)}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-primary-700 dark:text-primary-400 tabular-nums hidden sm:table-cell">{formatCurrency(data.reduce((s, d) => s + d.essenciais, 0))}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-amber-700 dark:text-amber-400 tabular-nums hidden sm:table-cell">{formatCurrency(data.reduce((s, d) => s + d.outros, 0))}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-red-600 tabular-nums hidden md:table-cell">{formatCurrency(totalCartoes)}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(totalDespesas)}</td>
                    <td className="py-2.5 px-2 text-right font-bold tabular-nums">
                      <span className={totalSaldo >= 0 ? "text-emerald-600" : "text-red-600"}>{formatCurrency(totalSaldo)}</span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold tabular-nums hidden lg:table-cell">
                      <span className={(data[data.length - 1]?.saldoAcumulado ?? 0) >= 0 ? "text-violet-600 dark:text-violet-400" : "text-red-600"}>
                        {formatCurrency(data[data.length - 1]?.saldoAcumulado ?? 0)}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-600 dark:text-slate-300">
                      {totalReceitas > 0 ? `${((totalDespesas / totalReceitas) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Gráficos (2 essenciais) ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Composição das Despesas */}
            <div className="card transition-colors">
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3">Composição das Despesas</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={36} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="essenciais" name="Essenciais" stackId="a" fill="#6366f1" />
                  <Bar dataKey="outros"     name="Outros"     stackId="a" fill="#f59e0b" />
                  <Bar dataKey="cartoes"    name="Cartões"    stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Saldo Acumulado */}
            <div className="card transition-colors">
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3">Saldo Acumulado</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} domain={["auto", "auto"]} width={36} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado" stroke="#6366f1" fill="url(#saldoGrad)" strokeWidth={2} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
