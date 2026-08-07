"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { getFixedBills, getBalanceOverrides } from "@/lib/queries";
import { formatCurrency, getMonthName, getAccConfig } from "@/lib/utils";
import { computeYearBalances, clearBalanceCache } from "@/lib/balance";
import { MONTH_SHORT } from "@/types";
import type { FixedBill, MonthlyBalanceOverride } from "@/types";
import {
  Plus, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Wallet, FlaskConical,
  RotateCcw,
} from "lucide-react";
import { applyMods, newMod } from "@/lib/simulador/applyMods";
import type { ScenarioMod, MonthData, AccCfg } from "@/lib/simulador/applyMods";
import { ModCard } from "@/components/simulador/ModCard";
import { ScenarioChart } from "@/components/simulador/ScenarioChart";

const STORAGE_KEY = "simulador_v2";

function Delta({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const good = inverse ? value < 0 : value > 0;
  if (value === 0) return <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>;
  return (
    <span className={`text-xs font-bold ${good ? "text-emerald-600" : "text-red-500"}`}>
      {value > 0 ? "+" : ""}{formatCurrency(value)}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SimuladorPage() {
  const [year, setYear]     = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [baseData, setBaseData] = useState<MonthData[]>([]);
  const [bills, setBills]   = useState<FixedBill[]>([]);

  const [scenarioName, setScenarioName] = useState("Cenário Simulado");
  const [mods, setMods]     = useState<ScenarioMod[]>([]);
  const [yearStartBalance, setYearStartBalance] = useState(0);
  const [accCfg, setAccCfg] = useState<AccCfg>(() => getAccConfig());
  const [overrides, setOverrides] = useState<MonthlyBalanceOverride[]>([]);

  // Persist scenario
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { const p = JSON.parse(saved); setScenarioName(p.name ?? "Cenário Simulado"); setMods(p.mods ?? []); }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: scenarioName, mods })); } catch {}
  }, [scenarioName, mods]);

  useEffect(() => { loadYear(); }, [year]);

  async function loadYear() {
    setLoading(true);
    try {
      const [allBills, yearOverrides] = await Promise.all([
        getFixedBills(),
        getBalanceOverrides(year),
      ]);
      setBills(allBills);
      setOverrides(yearOverrides);
      const cfg = getAccConfig();
      setAccCfg(cfg);

      // Usa módulo centralizado (respeita overrides, carry-over, dízimo dinâmico)
      clearBalanceCache();
      const yearData = await computeYearBalances(year, cfg);

      // Calcula startBalance (carry-over) para applyMods recalcular o cenário
      // Encontra o primeiro mês com acumulação válida e deduz o saldo dele
      const firstValid = yearData.find(md => md.saldoAcumulado !== null);
      const startBal = firstValid
        ? firstValid.saldoAcumulado! - firstValid.balance
        : cfg.saldoInicial;
      setYearStartBalance(startBal);

      setBaseData(yearData.map((md, i) => ({
        month: i + 1,
        name: MONTH_SHORT[i],
        receitas: md.totalIncome,
        billsTotal: md.totalBills,
        cartoes: md.totalCards,
        despesas: md.totalBills + md.totalCards,
        saldo: md.balance,
        saldoAcumulado: md.saldoAcumulado ?? 0,
      })));
    } finally { setLoading(false); }
  }

  // Derived — memoizados para evitar recalcular em cada render
  const scenarioData = useMemo(
    () => applyMods(baseData, mods, bills, year, yearStartBalance, accCfg, overrides),
    [baseData, mods, bills, year, yearStartBalance, accCfg, overrides],
  );

  const totBase = useMemo(() => ({
    receitas:   baseData.reduce((s, d) => s + d.receitas, 0),
    despesas:   baseData.reduce((s, d) => s + d.despesas, 0),
    saldoFinal: baseData[11]?.saldoAcumulado ?? 0,
  }), [baseData]);

  const totScen = useMemo(() => ({
    receitas:   scenarioData.reduce((s, d) => s + d.receitas, 0),
    despesas:   scenarioData.reduce((s, d) => s + d.despesas, 0),
    saldoFinal: scenarioData[11]?.saldoAcumulado ?? 0,
  }), [scenarioData]);

  const delta = useMemo(() => ({
    receitas:   totScen.receitas   - totBase.receitas,
    despesas:   totScen.despesas   - totBase.despesas,
    saldoFinal: totScen.saldoFinal - totBase.saldoFinal,
  }), [totBase, totScen]);

  const chartData = useMemo(() => baseData.map((row, i) => ({
    name: row.name,
    Atual: Math.round(row.saldoAcumulado),
    [scenarioName]: Math.round(scenarioData[i]?.saldoAcumulado ?? 0),
  })), [baseData, scenarioData, scenarioName]);

  const hasMods = mods.some(m => {
    if (m.type === "remove_bill") return !!m.billId;
    if (m.type === "pay_off_installment") return !!m.billId;
    if (m.type === "loan") return m.amount > 0 && (m.loanInstallments ?? 0) > 0;
    return m.amount !== 0;
  });

  function addMod() { setMods(ms => [...ms, newMod()]); }
  function removeMod(id: string) { setMods(ms => ms.filter(m => m.id !== id)); }
  function updateMod(id: string, patch: Partial<ScenarioMod>) {
    setMods(ms => ms.map(m => m.id === id ? { ...m, ...patch } : m));
  }

  return (
    <div className="p-3 md:p-6 min-h-screen">
      <PageHeader title="Simulador de Cenários" subtitle="Compare o cenário atual com hipóteses futuras">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-1 py-1">
          <button onClick={() => setYear(y => y - 1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <ChevronLeft size={15} className="text-slate-600 dark:text-slate-300" />
          </button>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[44px] text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <ChevronRight size={15} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Builder ───────────────────────────────────────────────────────── */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <FlaskConical size={16} className="text-primary-500 shrink-0" />
              <input
                className="flex-1 text-sm font-semibold bg-transparent text-slate-700 dark:text-slate-200
                           border-b border-dashed border-slate-300 dark:border-slate-600
                           focus:outline-none focus:border-primary-500 pb-0.5 min-w-0"
                value={scenarioName}
                onChange={e => setScenarioName(e.target.value)}
                placeholder="Nome do cenário"
                maxLength={40}
              />
              {mods.length > 0 && (
                <button
                  onClick={() => { if (confirm("Limpar todas as modificações?")) setMods([]); }}
                  title="Limpar tudo"
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <button
                onClick={addMod}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                           bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors shrink-0"
              >
                <Plus size={13} /> Adicionar
              </button>
            </div>

            {mods.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                <FlaskConical size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhuma modificação ainda</p>
                <p className="text-xs mt-1 opacity-70">Clique em "Adicionar" para criar um cenário hipotético</p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-left max-w-lg mx-auto">
                  {([
                    ["Quitar empréstimo", "Veja quanto sobra sem a parcela mensal"],
                    ["Aumento de salário", "Simule o impacto de uma promoção"],
                    ["Venda de veículo", "Receita avulsa + fim de IPVA e seguro"],
                    ["Novo financiamento", "Compare antes e depois de contrair dívida"],
                    ["Renda extra", "Freela, aluguel ou investimento extra"],
                    ["Trocar empréstimo", "Remove um e adiciona outro com parcela menor"],
                  ] as [string, string][]).map(([title, desc]) => (
                    <div key={title} className="text-left bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2.5">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {mods.map((mod, idx) => (
                  <ModCard
                    key={mod.id}
                    mod={mod}
                    idx={idx}
                    year={year}
                    bills={bills}
                    onUpdate={updateMod}
                    onRemove={removeMod}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Resultados (só se tiver mods válidas) ────────────────────────── */}
          {hasMods && (
            <>
              {/* Delta KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: "Receitas no ano",
                    base: totBase.receitas,
                    scen: totScen.receitas,
                    diff: delta.receitas,
                    icon: TrendingUp,
                    inverse: false,
                  },
                  {
                    label: "Despesas no ano",
                    base: totBase.despesas,
                    scen: totScen.despesas,
                    diff: delta.despesas,
                    icon: TrendingDown,
                    inverse: true,
                  },
                  {
                    label: "Saldo acum. final",
                    base: totBase.saldoFinal,
                    scen: totScen.saldoFinal,
                    diff: delta.saldoFinal,
                    icon: Wallet,
                    inverse: false,
                  },
                ].map(({ label, base, scen, diff, icon: Icon, inverse }) => {
                  const good = inverse ? diff < 0 : diff > 0;
                  const neutral = diff === 0;
                  return (
                    <div key={label} className={`rounded-xl border p-4 transition-colors ${
                      neutral ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      : good   ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30"
                               : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
                        <Icon size={14} className={neutral ? "text-slate-400" : good ? "text-emerald-500" : "text-red-400"} />
                      </div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs text-slate-400 line-through tabular-nums">{formatCurrency(base)}</span>
                        <span className={`text-lg font-bold tabular-nums ${
                          neutral ? "text-slate-600 dark:text-slate-200"
                          : good   ? "text-emerald-600 dark:text-emerald-400"
                                   : "text-red-600"
                        }`}>
                          {formatCurrency(scen)}
                        </span>
                      </div>
                      <p className={`text-xs font-semibold mt-1 ${neutral ? "text-slate-400" : good ? "text-emerald-600" : "text-red-500"}`}>
                        {neutral ? "Sem diferenca"
                          : `${diff > 0 ? "+" : ""}${formatCurrency(diff)} / ${good ? "melhor" : "pior"}`}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Tabela comparativa mês a mês */}
              <div className="card overflow-hidden">
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3">
                  Comparativo Mês a Mês — {year}
                </h3>
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-xs min-w-[420px]">
                    <thead>
                      <tr className="border-b-2 border-slate-200 dark:border-slate-600">
                        <th className="text-left py-2 text-slate-400 uppercase tracking-wide font-semibold" rowSpan={2}>Mês</th>
                        <th className="text-center py-1 px-1 text-emerald-600 uppercase tracking-wide font-semibold border-b border-emerald-200 dark:border-emerald-800/30 hidden lg:table-cell" colSpan={3}>Receitas</th>
                        <th className="text-center py-1 px-1 text-red-500 uppercase tracking-wide font-semibold border-b border-red-200 dark:border-red-800/30 hidden lg:table-cell" colSpan={3}>Despesas</th>
                        <th className="text-center py-1 px-1 text-slate-500 dark:text-slate-400 uppercase tracking-wide font-semibold border-b border-slate-200 dark:border-slate-600 hidden sm:table-cell" colSpan={3}>Saldo Mensal</th>
                        <th className="text-center py-1 px-1 text-primary-600 uppercase tracking-wide font-semibold border-b border-primary-200 dark:border-primary-800/30" colSpan={3}>Acumulado</th>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-700/50">
                        {/* Receitas sub-headers */}
                        <th className="text-right py-1.5 px-1 text-slate-400 text-[10px] uppercase hidden lg:table-cell">Hoje</th>
                        <th className="text-right py-1.5 px-1 text-primary-500 text-[10px] hidden lg:table-cell truncate max-w-[80px]">{scenarioName}</th>
                        <th className="text-right py-1.5 px-1 text-slate-400 text-[10px] uppercase hidden lg:table-cell">Δ</th>
                        {/* Despesas sub-headers */}
                        <th className="text-right py-1.5 px-1 text-slate-400 text-[10px] uppercase hidden lg:table-cell">Hoje</th>
                        <th className="text-right py-1.5 px-1 text-primary-500 text-[10px] hidden lg:table-cell truncate max-w-[80px]">{scenarioName}</th>
                        <th className="text-right py-1.5 px-1 text-slate-400 text-[10px] uppercase hidden lg:table-cell">Δ</th>
                        {/* Saldo mensal sub-headers */}
                        <th className="text-right py-1.5 px-1 text-slate-400 text-[10px] uppercase hidden sm:table-cell">Hoje</th>
                        <th className="text-right py-1.5 px-1 text-primary-500 text-[10px] hidden sm:table-cell truncate max-w-[80px]">{scenarioName}</th>
                        <th className="text-right py-1.5 px-1 text-slate-400 text-[10px] uppercase hidden sm:table-cell">Δ</th>
                        {/* Acumulado sub-headers */}
                        <th className="text-right py-1.5 px-1 text-slate-400 text-[10px] uppercase">Hoje</th>
                        <th className="text-right py-1.5 px-1 text-primary-500 text-[10px] truncate max-w-[80px]">{scenarioName}</th>
                        <th className="text-right py-1.5 px-1 text-slate-400 text-[10px] uppercase">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baseData.map((row, i) => {
                        const sc = scenarioData[i];
                        const dRec = sc.receitas - row.receitas;
                        const dDesp = sc.despesas - row.despesas;
                        const dSaldo = sc.saldo - row.saldo;
                        const dAcum = sc.saldoAcumulado - row.saldoAcumulado;
                        const changed = dRec !== 0 || dDesp !== 0;
                        return (
                          <tr key={row.month}
                            className={`border-b border-slate-50 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                              changed ? "bg-primary-50/30 dark:bg-primary-900/5" : ""
                            }`}
                          >
                            <td className="py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                              {getMonthName(row.month)}
                              {changed && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary-400 inline-block align-middle" />}
                            </td>
                            {/* Receitas */}
                            <td className="py-2 px-1 text-right text-emerald-600 tabular-nums hidden lg:table-cell">{formatCurrency(row.receitas)}</td>
                            <td className="py-2 px-1 text-right text-emerald-700 font-medium tabular-nums hidden lg:table-cell">{formatCurrency(sc.receitas)}</td>
                            <td className="py-2 px-1 text-right hidden lg:table-cell"><Delta value={dRec} /></td>
                            {/* Despesas */}
                            <td className="py-2 px-1 text-right text-red-500 tabular-nums hidden lg:table-cell">{formatCurrency(row.despesas)}</td>
                            <td className="py-2 px-1 text-right text-red-700 font-medium tabular-nums hidden lg:table-cell">{formatCurrency(sc.despesas)}</td>
                            <td className="py-2 px-1 text-right hidden lg:table-cell"><Delta value={dDesp} inverse /></td>
                            {/* Saldo mensal */}
                            <td className="py-2 px-1 text-right tabular-nums hidden sm:table-cell">
                              <span className={row.saldo >= 0 ? "text-emerald-600" : "text-red-500"}>
                                {formatCurrency(row.saldo)}
                              </span>
                            </td>
                            <td className="py-2 px-1 text-right font-medium tabular-nums hidden sm:table-cell">
                              <span className={sc.saldo >= 0 ? "text-primary-600 dark:text-primary-400" : "text-red-600"}>
                                {formatCurrency(sc.saldo)}
                              </span>
                            </td>
                            <td className="py-2 px-1 text-right hidden sm:table-cell"><Delta value={dSaldo} /></td>
                            {/* Acumulado */}
                            <td className="py-2 px-1 text-right tabular-nums font-medium">
                              <span className={row.saldoAcumulado >= 0 ? "text-slate-600 dark:text-slate-300" : "text-red-500"}>
                                {formatCurrency(row.saldoAcumulado)}
                              </span>
                            </td>
                            <td className="py-2 px-1 text-right tabular-nums font-bold">
                              <span className={sc.saldoAcumulado >= 0 ? "text-primary-600 dark:text-primary-400" : "text-red-600"}>
                                {formatCurrency(sc.saldoAcumulado)}
                              </span>
                            </td>
                            <td className="py-2 px-1 text-right"><Delta value={dAcum} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 font-bold">
                        <td className="py-2.5 text-slate-700 dark:text-slate-200">TOTAL</td>
                        {/* Receitas total */}
                        <td className="py-2.5 px-1 text-right text-emerald-600 tabular-nums hidden lg:table-cell">{formatCurrency(totBase.receitas)}</td>
                        <td className="py-2.5 px-1 text-right text-emerald-700 tabular-nums hidden lg:table-cell">{formatCurrency(totScen.receitas)}</td>
                        <td className="py-2.5 px-1 text-right hidden lg:table-cell"><Delta value={delta.receitas} /></td>
                        {/* Despesas total */}
                        <td className="py-2.5 px-1 text-right text-red-500 tabular-nums hidden lg:table-cell">{formatCurrency(totBase.despesas)}</td>
                        <td className="py-2.5 px-1 text-right text-red-700 tabular-nums hidden lg:table-cell">{formatCurrency(totScen.despesas)}</td>
                        <td className="py-2.5 px-1 text-right hidden lg:table-cell"><Delta value={delta.despesas} inverse /></td>
                        {/* Saldo mensal total (soma dos saldos) */}
                        <td className="py-2.5 px-1 text-right tabular-nums hidden sm:table-cell">
                          <span className={totBase.receitas - totBase.despesas >= 0 ? "text-emerald-600" : "text-red-500"}>
                            {formatCurrency(totBase.receitas - totBase.despesas)}
                          </span>
                        </td>
                        <td className="py-2.5 px-1 text-right tabular-nums hidden sm:table-cell">
                          <span className={totScen.receitas - totScen.despesas >= 0 ? "text-primary-600 dark:text-primary-400" : "text-red-600"}>
                            {formatCurrency(totScen.receitas - totScen.despesas)}
                          </span>
                        </td>
                        <td className="py-2.5 px-1 text-right hidden sm:table-cell"><Delta value={(totScen.receitas - totScen.despesas) - (totBase.receitas - totBase.despesas)} /></td>
                        {/* Acumulado final */}
                        <td className="py-2.5 px-1 text-right tabular-nums">
                          <span className={totBase.saldoFinal >= 0 ? "text-slate-700 dark:text-slate-200" : "text-red-500"}>{formatCurrency(totBase.saldoFinal)}</span>
                        </td>
                        <td className="py-2.5 px-1 text-right tabular-nums">
                          <span className={totScen.saldoFinal >= 0 ? "text-primary-600 dark:text-primary-400" : "text-red-600"}>{formatCurrency(totScen.saldoFinal)}</span>
                        </td>
                        <td className="py-2.5 text-right"><Delta value={delta.saldoFinal} /></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Gráfico Saldo Acumulado */}
              <ScenarioChart chartData={chartData} scenarioName={scenarioName} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
