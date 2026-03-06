"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, CreditCard,
  ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight,
  Trophy, AlertCircle, BarChart2, Calendar,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
  AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ReferenceLine, Cell,
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
      const sources = await getIncomeSources();

      // Carrega os 12 meses em paralelo (sem acumular saldo — race condition)
      const rawMonths = await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
          const month = i + 1;
          const [incomes, billPays, txs] = await Promise.all([
            getMonthlyIncomes(month, year),
            getMonthlyBillPayments(month, year),
            getCardTransactions(month, year),
          ]);

          // Receitas — recorrentes usam fallback base_amount; avulsas só do mês correto
          const receitas = sources.reduce((s, src) => {
            const mi = incomes.find(i => i.source_id === src.id);
            if (src.is_recurring === false) {
              if (src.one_time_month !== month || src.one_time_year !== year) return s;
              return s + (mi?.amount ?? src.base_amount);
            }
            return s + (mi?.amount ?? src.base_amount);
          }, 0);

          // Contas por categoria — exclui parcelas fora do range ativo
          const paidBillIds = billPays.map(b => b.bill_id);
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
          const outros = allMonthBills.filter(b => b.category !== "essencial").reduce((s, b) => s + b.amount, 0);

          // Cartões — valor líquido (despesas negativas + créditos positivos)
          const cartoes = txs.reduce((s, t) => s - t.amount, 0);

          const despesas = essenciais + outros + cartoes;
          return {
            month,
            name: MONTH_SHORT[i],
            receitas,
            essenciais,
            outros,
            cartoes,
            despesas,
            saldo: receitas - despesas,
            saldoAcumulado: 0, // calculado abaixo, após Promise.all
          };
        })
      );

      // Calcula saldoAcumulado sequencialmente (Promise.all preserva a ordem Jan→Dez)
      let acc = 0;
      const months = rawMonths.map(m => {
        acc += m.saldo;
        return { ...m, saldoAcumulado: acc };
      });
      setData(months);
    } finally {
      setLoading(false);
    }
  }

  // Totals
  const totalReceitas = data.reduce((s, d) => s + d.receitas, 0);
  const totalDespesas = data.reduce((s, d) => s + d.despesas, 0);
  const totalCartoes = data.reduce((s, d) => s + d.cartoes, 0);
  const totalSaldo = totalReceitas - totalDespesas;

  // Best/Worst
  const monthsWithData = data.filter(d => d.receitas > 0 || d.despesas > 0);
  const melhorMes = monthsWithData.length > 0
    ? monthsWithData.reduce((best, d) => d.saldo > best.saldo ? d : best, monthsWithData[0])
    : null;
  const piorMes = monthsWithData.length > 0
    ? monthsWithData.reduce((worst, d) => d.saldo < worst.saldo ? d : worst, monthsWithData[0])
    : null;

  const avgReceitas = totalReceitas / 12;
  const avgDespesas = totalDespesas / 12;

  // Radar — perfil de gastos por categoria (1º semestre)
  const radarData = data.slice(0, 6).map(d => ({
    month: d.name,
    Essenciais: d.essenciais,
    Outros: d.outros,
    Cartões: d.cartoes,
  }));

  // Taxa de poupança mensal (%)
  const savingsRateData = data.map(d => ({
    name: d.name,
    taxa: d.receitas > 0 ? parseFloat(((d.saldo / d.receitas) * 100).toFixed(1)) : 0,
    saldo: d.saldo,
  }));

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <PageHeader title="Gastos Anuais" subtitle="Visão completa do ano">
        {/* Year Selector */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-1 py-1 transition-colors">
          <button onClick={() => setYear(y => y - 1)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <ChevronLeft size={16} className="text-slate-600 dark:text-slate-300" />
          </button>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[48px] text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <ChevronRight size={16} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-4 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Total Receitas {year}</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalReceitas)}</p>
              <p className="text-xs text-emerald-600 mt-1">
                Média {formatCurrency(avgReceitas)}/mês
              </p>
            </div>
            <div className="bg-emerald-100 dark:bg-emerald-800/40 p-2 rounded-xl">
              <TrendingUp size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-xl p-4 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Total Despesas {year}</p>
              <p className="text-xl font-bold text-red-700 dark:text-red-400">{formatCurrency(totalDespesas)}</p>
              <p className="text-xs text-red-600 mt-1">
                Média {formatCurrency(avgDespesas)}/mês
              </p>
            </div>
            <div className="bg-red-100 dark:bg-red-800/40 p-2 rounded-xl">
              <TrendingDown size={18} className="text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl p-4 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Total Cartões {year}</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(totalCartoes)}</p>
              <p className="text-xs text-amber-600 mt-1">
                Média {formatCurrency(totalCartoes / 12)}/mês
              </p>
            </div>
            <div className="bg-amber-100 dark:bg-amber-800/40 p-2 rounded-xl">
              <CreditCard size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>

        <div className={`border rounded-xl p-4 transition-colors ${totalSaldo >= 0 ? "bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800/30" : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30"}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Saldo Anual</p>
              <p className={`text-xl font-bold ${totalSaldo >= 0 ? "text-primary-700 dark:text-primary-400" : "text-red-700 dark:text-red-400"}`}>
                {formatCurrency(totalSaldo)}
              </p>
              <p className={`text-xs mt-1 ${totalSaldo >= 0 ? "text-primary-600" : "text-red-500"}`}>
                {totalReceitas > 0
                  ? `${((totalDespesas / totalReceitas) * 100).toFixed(1)}% comprometido`
                  : "—"}
              </p>
            </div>
            <div className={`p-2 rounded-xl ${totalSaldo >= 0 ? "bg-primary-100 dark:bg-primary-800/40" : "bg-red-100 dark:bg-red-800/40"}`}>
              <Wallet size={18} className={totalSaldo >= 0 ? "text-primary-600 dark:text-primary-400" : "text-red-600 dark:text-red-400"} />
            </div>
          </div>
        </div>
      </div>

      {/* Best/Worst highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-6">
        {melhorMes && (
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={15} className="text-emerald-200" />
              <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wide">
                Melhor mês
              </span>
            </div>
            <p className="text-lg font-bold">{getMonthName(melhorMes.month)}</p>
            <p className="text-sm text-emerald-100">
              Saldo: {formatCurrency(melhorMes.saldo)} · Receitas: {formatCurrency(melhorMes.receitas)}
            </p>
          </div>
        )}
        {piorMes && (
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={15} className="text-red-200" />
              <span className="text-xs font-semibold text-red-100 uppercase tracking-wide">
                Mês mais pesado
              </span>
            </div>
            <p className="text-lg font-bold">{getMonthName(piorMes.month)}</p>
            <p className="text-sm text-red-100">
              Saldo: {formatCurrency(piorMes.saldo)} · Despesas: {formatCurrency(piorMes.despesas)}
            </p>
          </div>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Stacked Bar Chart */}
        <div className="card transition-colors">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
            <BarChart2 size={15} className="text-slate-400 dark:text-slate-500" />
            Composição das Despesas — {year}
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="essenciais" name="Essenciais" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
              <Bar dataKey="outros" name="Outros" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cartoes" name="Cartões" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Area Chart — Saldo acumulado */}
        <div className="card transition-colors">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-slate-400 dark:text-slate-500" />
            Evolução do Saldo Acumulado
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                domain={['auto', 'auto']} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="saldoAcumulado"
                name="Saldo Acumulado"
                stroke="#6366f1"
                fill="url(#saldoGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Line chart Receitas vs Despesas */}
      <div className="card mb-4 transition-colors">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
          <Calendar size={15} className="text-slate-400 dark:text-slate-500" />
          Receitas vs Despesas — Mês a Mês
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`}
              domain={['auto', 'auto']} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row 3 — RadarChart + Taxa de Poupança */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Radar — Perfil de gastos 1º semestre */}
        <div className="card transition-colors">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-1 flex items-center gap-2">
            <BarChart2 size={15} className="text-slate-400 dark:text-slate-500" />
            Perfil de Gastos — 1º Semestre
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            Distribuição de Essenciais, Outros e Cartões por mês
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
              <PolarGrid />
              <PolarAngleAxis dataKey="month" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis
                angle={30}
                tick={{ fontSize: 9, fill: "#94a3b8" }}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
              />
              <Radar name="Essenciais" dataKey="Essenciais" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
              <Radar name="Outros" dataKey="Outros" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
              <Radar name="Cartões" dataKey="Cartões" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Taxa de Poupança mensal */}
        <div className="card transition-colors">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-1 flex items-center gap-2">
            <TrendingUp size={15} className="text-slate-400 dark:text-slate-500" />
            Taxa de Poupança Mensal
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            % da renda que sobrou (ou faltou) a cada mês
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={savingsRateData} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip content={<ChartTooltip formatter={(v, name) => name === "Taxa de Poupança" ? `${v.toFixed(1)}%` : formatCurrency(v)} />} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
              <Bar dataKey="taxa" name="Taxa de Poupança" radius={[4, 4, 0, 0]}>
                {savingsRateData.map((entry, i) => (
                  <Cell key={i} fill={entry.taxa >= 0 ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="card transition-colors">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-4">Resumo Mensal Detalhado</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700/50">
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Mês</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide">Receitas</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-primary-600 uppercase tracking-wide">Essenciais</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-amber-600 uppercase tracking-wide">Outros</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-red-500 uppercase tracking-wide">Cartões</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Desp.</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Saldo</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-violet-600 uppercase tracking-wide">Saldo Acum.</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">% Renda</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.month}
                  className={`border-b border-slate-50 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    row.month === new Date().getMonth() + 1 && year === new Date().getFullYear()
                      ? "bg-primary-50/30"
                      : ""
                  }`}
                >
                  <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-200">
                    {getMonthName(row.month)}
                    {row.month === new Date().getMonth() + 1 && year === new Date().getFullYear() && (
                      <span className="ml-2 text-xs bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 px-1.5 py-0.5 rounded-full">atual</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-emerald-700 dark:text-emerald-400">
                    {row.receitas > 0 ? formatCurrency(row.receitas) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right text-primary-700 dark:text-primary-400">
                    {formatCurrency(row.essenciais)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-700 dark:text-amber-400">
                    {formatCurrency(row.outros)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-red-600">
                    {row.cartoes > 0 ? formatCurrency(row.cartoes) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-200 font-medium">
                    {formatCurrency(row.despesas)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold">
                    <span className={row.saldo >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {row.saldo >= 0 ? (
                        <ArrowUpRight size={12} className="inline mr-0.5" />
                      ) : (
                        <ArrowDownRight size={12} className="inline mr-0.5" />
                      )}
                      {formatCurrency(row.saldo)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold">
                    <span className={row.saldoAcumulado >= 0 ? "text-violet-600 dark:text-violet-400" : "text-red-600"}>
                      {formatCurrency(row.saldoAcumulado)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {row.receitas > 0 ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              (row.despesas / row.receitas) > 0.9 ? "bg-red-500" :
                              (row.despesas / row.receitas) > 0.7 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min((row.despesas / row.receitas) * 100, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs ${
                          (row.despesas / row.receitas) > 0.9 ? "text-red-600" :
                          (row.despesas / row.receitas) > 0.7 ? "text-amber-600" : "text-emerald-600"
                        }`}>
                          {((row.despesas / row.receitas) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ) : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
                <td className="py-3 px-3 font-bold text-slate-700 dark:text-slate-200">TOTAL</td>
                <td className="py-3 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalReceitas)}</td>
                <td className="py-3 px-3 text-right font-bold text-primary-700 dark:text-primary-400">
                  {formatCurrency(data.reduce((s, d) => s + d.essenciais, 0))}
                </td>
                <td className="py-3 px-3 text-right font-bold text-amber-700 dark:text-amber-400">
                  {formatCurrency(data.reduce((s, d) => s + d.outros, 0))}
                </td>
                <td className="py-3 px-3 text-right font-bold text-red-600">{formatCurrency(totalCartoes)}</td>
                <td className="py-3 px-3 text-right font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totalDespesas)}</td>
                <td className="py-3 px-3 text-right font-bold">
                  <span className={totalSaldo >= 0 ? "text-emerald-600" : "text-red-600"}>
                    {formatCurrency(totalSaldo)}
                  </span>
                </td>
                <td className="py-3 px-3 text-right font-bold">
                  {(() => {
                    const last = data[data.length - 1];
                    const acc = last?.saldoAcumulado ?? 0;
                    return (
                      <span className={acc >= 0 ? "text-violet-600 dark:text-violet-400" : "text-red-600"}>
                        {formatCurrency(acc)}
                      </span>
                    );
                  })()}
                </td>
                <td className="py-3 px-3 text-right font-bold text-slate-600 dark:text-slate-300">
                  {totalReceitas > 0 ? `${((totalDespesas / totalReceitas) * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
