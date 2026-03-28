"use client";

import { useEffect, useState } from "react";
import {
  CreditCard, TrendingDown, Hash, Award,
  ChevronLeft, ChevronRight, ShoppingCart,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { getCreditCards, getCardTransactions } from "@/lib/queries";
import { formatCurrency, getCurrentMonth, getMonthName } from "@/lib/utils";
import { MONTH_SHORT } from "@/types";
import type { CreditCard as CreditCardType, CardTransaction } from "@/types";

export default function GastosCataoesPage() {
  const { month: cm, year: cy } = getCurrentMonth();
  const [month, setMonth] = useState(cm);
  const [year, setYear] = useState(cy);
  const [viewMode, setViewMode] = useState<"mensal" | "anual">("mensal");

  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [txs, setTxs] = useState<CardTransaction[]>([]);
  const [yearlyByCard, setYearlyByCard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCards(); }, []);
  useEffect(() => { if (cards.length > 0) loadData(); }, [month, year, cards, viewMode]);

  async function loadCards() {
    const cs = await getCreditCards();
    setCards(cs);
  }

  async function loadData() {
    setLoading(true);
    try {
      if (viewMode === "mensal") {
        const data = await getCardTransactions(month, year);
        setTxs(data);
      } else {
        const allTxs = await Promise.all(
          Array.from({ length: 12 }, (_, i) => getCardTransactions(i + 1, year))
        );
        const flat = allTxs.flat();
        setTxs(flat);

        const byMonth = Array.from({ length: 12 }, (_, i) => {
          const monthTxs = allTxs[i];
          const row: any = { name: MONTH_SHORT[i] };
          cards.forEach(card => {
            row[card.name] = monthTxs
              .filter(t => t.card_id === card.id)
              .reduce((s, t) => s + Math.abs(t.amount), 0);
          });
          return row;
        });
        setYearlyByCard(byMonth);
      }
    } finally {
      setLoading(false);
    }
  }

  const cardStats = cards.map(card => {
    const cardTxs = txs.filter(t => t.card_id === card.id);
    const total = cardTxs.reduce((s, t) => s + Math.abs(t.amount), 0);
    const count = cardTxs.length;
    const avg = count > 0 ? total / count : 0;
    const biggest = cardTxs.length > 0
      ? cardTxs.reduce((max, t) => Math.abs(t.amount) > Math.abs(max.amount) ? t : max, cardTxs[0])
      : null;
    return { card, total, count, avg, biggest, txs: cardTxs };
  }).sort((a, b) => b.total - a.total);

  const grandTotal = cardStats.reduce((s, c) => s + c.total, 0);
  const totalTxCount = cardStats.reduce((s, c) => s + c.count, 0);

  const pieData = cardStats
    .filter(c => c.total > 0)
    .map(c => ({ name: c.card.name, value: c.total, color: c.card.color }));

  const topTxs = [...txs]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 10);

  const descMap: Record<string, { count: number; total: number }> = {};
  txs.forEach(t => {
    const key = t.description.toLowerCase().trim();
    if (!descMap[key]) descMap[key] = { count: 0, total: 0 };
    descMap[key].count++;
    descMap[key].total += Math.abs(t.amount);
  });
  const topPlaces = Object.entries(descMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([name, stats]) => ({ name, ...stats }));

  return (
    <div className="p-3 md:p-6 min-h-screen">
      <PageHeader title="Gastos nos Cartões" subtitle="Análise detalhada das faturas">
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-1 transition-colors">
            <button
              onClick={() => setViewMode("mensal")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "mensal"
                  ? "bg-primary-600 text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setViewMode("anual")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "anual"
                  ? "bg-primary-600 text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Anual
            </button>
          </div>

          {viewMode === "mensal" ? (
            <MonthSelector month={month} year={year}
              onChange={(m, y) => { setMonth(m); setYear(y); }} />
          ) : (
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
          )}
        </div>
      </PageHeader>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 md:gap-3 mb-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-xl p-3 transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Total Gasto</p>
          <p className="text-base font-bold text-red-700 dark:text-red-400">{formatCurrency(grandTotal)}</p>
          <p className="text-xs text-red-500 mt-0.5">
            {viewMode === "mensal" ? `${getMonthName(month)} ${year}` : `Ano ${year}`}
          </p>
        </div>

        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 rounded-xl p-3 transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Cartões Ativos</p>
          <p className="text-base font-bold text-primary-700 dark:text-primary-400">
            {cardStats.filter(c => c.total > 0).length}
            <span className="text-sm font-normal text-slate-400 dark:text-slate-500"> / {cards.length}</span>
          </p>
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">com gastos</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl p-3 transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Lançamentos</p>
          <p className="text-base font-bold text-amber-700 dark:text-amber-400">{totalTxCount}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Média {formatCurrency(totalTxCount > 0 ? grandTotal / totalTxCount : 0)}
          </p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-3 transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Maior Fatura</p>
          {cardStats[0]?.total > 0 ? (
            <>
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(cardStats[0].total)}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">{cardStats[0].card.name}</p>
            </>
          ) : (
            <p className="text-base font-bold text-slate-300 dark:text-slate-600">—</p>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        {/* Bar Chart por cartão */}
        <div className="lg:col-span-2 card">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-3">
            {viewMode === "mensal" ? "Gastos por Cartão" : "Evolução Mensal por Cartão"}
          </h3>
          <div className="overflow-x-auto -mx-4 px-4"><ResponsiveContainer width="100%" height={220} minWidth={400}>
            {viewMode === "mensal" ? (
              <BarChart
                data={cardStats.filter(c => c.total > 0).map(c => ({
                  name: c.card.name.replace(" HELDEM", " H.").replace(" VITORIA", " V."),
                  total: c.total,
                  color: c.card.color,
                  count: c.count,
                }))}
                margin={{ top: 5, right: 5, left: 5, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={v => `${(v / 1000).toFixed(1)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="total" name="Total" radius={[6, 6, 0, 0]}>
                  {cardStats.filter(c => c.total > 0).map((c, i) => (
                    <Cell key={i} fill={c.card.color} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <LineChart data={yearlyByCard} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={v => `${(v / 1000).toFixed(1)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {cards.map((card) => (
                  <Line
                    key={card.id}
                    type="monotone"
                    dataKey={card.name}
                    stroke={card.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer></div>
        </div>

        {/* Pie distribution */}
        <div className="card">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-4">Distribuição</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%"
                    innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[110px]">
                        {d.name.replace(" HELDEM", " H.").replace(" VITORIA", " V.")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(d.value)}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
                        {grandTotal > 0 ? `${((d.value / grandTotal) * 100).toFixed(0)}%` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[240px] flex items-center justify-center">
              <p className="text-slate-400 dark:text-slate-500 text-sm">Sem gastos no período</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top Transactions */}
        <div className="card">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-3 flex items-center gap-2">
            <TrendingDown size={15} className="text-slate-400 dark:text-slate-500" />
            Maiores Compras
          </h3>
          {topTxs.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-6">Sem lançamentos</p>
          ) : (
            <div className="space-y-0">
              {topTxs.map((tx, i) => {
                const card = cards.find(c => c.id === tx.card_id);
                return (
                  <div key={tx.id}
                    className="flex items-center justify-between py-2.5 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">{tx.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {card && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: card.color + "22", color: card.color }}>
                              {card.name.replace(" HELDEM", " H.").replace(" VITORIA", " V.")}
                            </span>
                          )}
                          {tx.transaction_date && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {new Date(tx.transaction_date + "T00:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          {tx.installment_total > 1 && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {tx.installment_current}/{tx.installment_total}x
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-red-600">
                      {formatCurrency(Math.abs(tx.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Places + Card Table */}
        <div className="space-y-4">
          {/* Top Estabelecimentos */}
          <div className="card">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-3 flex items-center gap-2">
              <ShoppingCart size={15} className="text-slate-400 dark:text-slate-500" />
              Top Estabelecimentos
            </h3>
            {topPlaces.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">Sem dados</p>
            ) : (
              <div className="space-y-2">
                {topPlaces.map((place, i) => (
                  <div key={place.name} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 capitalize">{place.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 dark:text-slate-500">{place.count}x</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{formatCurrency(place.total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                        <div
                          className="h-1.5 bg-primary-500 rounded-full"
                          style={{ width: `${(place.total / topPlaces[0].total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card comparison table */}
          <div className="card">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-3">Comparativo dos Cartões</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/50">
                  <th className="text-left py-1.5 text-slate-500 dark:text-slate-400 font-semibold">Cartão</th>
                  <th className="text-right py-1.5 text-slate-500 dark:text-slate-400 font-semibold">Total</th>
                  <th className="text-right py-1.5 text-slate-500 dark:text-slate-400 font-semibold">Lançtos</th>
                  <th className="text-right py-1.5 text-slate-500 dark:text-slate-400 font-semibold">Vence</th>
                </tr>
              </thead>
              <tbody>
                {cardStats.map(({ card, total, count }) => (
                  <tr key={card.id} className="border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                        <span className="text-slate-700 dark:text-slate-200 font-medium truncate max-w-[120px]">
                          {card.name.replace(" HELDEM", " H.").replace(" VITORIA", " V.")}
                        </span>
                      </div>
                    </td>
                    <td className={`py-2 text-right font-bold ${total > 0 ? "text-red-600" : "text-slate-300 dark:text-slate-600"}`}>
                      {total > 0 ? formatCurrency(total) : "—"}
                    </td>
                    <td className="py-2 text-right text-slate-500 dark:text-slate-400">{count}</td>
                    <td className="py-2 text-right">
                      <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                        Dia {card.due_day}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
