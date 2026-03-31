"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import {
  getFixedBills, getIncomeSources, getMonthlyIncomes,
  getMonthlyBillPayments, getCardTransactions,
} from "@/lib/queries";
import { formatCurrency, getMonthName, computeInstallment, getAccConfig } from "@/lib/utils";
import { calculateAmortization, loanSummary } from "@/lib/loan";
import type { LoanParams, AmortizationRow } from "@/lib/loan";
import { MONTH_SHORT } from "@/types";
import type { FixedBill } from "@/types";
import {
  Plus, Trash2, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Wallet, FlaskConical,
  ArrowUpRight, ArrowDownRight, Calculator, ChevronDown as ChevDown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ModType =
  | "remove_bill"          // Remover conta fixa (para sempre)
  | "pay_off_installment"  // Quitar parcelamento/financiamento de uma vez
  | "add_expense"          // Nova despesa mensal
  | "income_change"        // Alterar renda (+/-)
  | "one_time_income"      // Receita avulsa
  | "one_time_expense"     // Despesa avulsa
  | "loan";                // Novo empréstimo / Financiamento

interface ScenarioMod {
  id: string;
  type: ModType;
  billId: string;
  amount: number;
  startMonth: number;
  endMonth: number;
  // Campos de empréstimo
  loanRate?: number;
  loanInstallments?: number;
  loanMethod?: "price" | "sac";
  // Quitação customizada (pay_off_installment)
  payoffAmount?: number;     // valor customizado; se null usa cálculo automático
}

interface MonthData {
  month: number;
  name: string;
  receitas: number;
  billsTotal: number;
  cartoes: number;
  despesas: number;
  saldo: number;
  saldoAcumulado: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MOD_LABELS: Record<ModType, string> = {
  remove_bill:          "Remover conta fixa (mensal)",
  pay_off_installment:  "Quitar parcelamento / financiamento de uma vez",
  add_expense:          "Nova despesa mensal",
  income_change:        "Alterar renda mensal (+/-)",
  one_time_income:      "Receita avulsa (unico mes)",
  one_time_expense:     "Despesa avulsa (unico mes)",
  loan:                 "Novo emprestimo / Financiamento",
};

const MOD_EXAMPLES: Record<ModType, string> = {
  remove_bill:          "Ex: cancelar academia, encerrar plano",
  pay_off_installment:  "Ex: quitar carro, pagar emprestimo, antecipar parcelas",
  add_expense:          "Ex: novo plano de saude, academia",
  income_change:        "Ex: +1.000 aumento, -500 reducao",
  one_time_income:      "Ex: venda de veiculo, FGTS, bonus",
  one_time_expense:     "Ex: IPTU a vista, cirurgia, viagem",
  loan:                 "Ex: emprestimo pessoal, financiamento de carro",
};

const MONTH_OPTS = Array.from({ length: 12 }, (_, i) => i + 1);
const STORAGE_KEY = "simulador_v2";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newMod(): ScenarioMod {
  return {
    id: crypto.randomUUID(),
    type: "remove_bill",
    billId: "",
    amount: 0,
    startMonth: new Date().getMonth() + 1,
    endMonth: 12,
  };
}

/** Verifica se uma conta tem alguma parcela ativa no ano informado */
function isBillActiveInYear(bill: FixedBill, year: number): boolean {
  if (!bill.installment_total || bill.installment_start_month == null || bill.installment_start_year == null) {
    return true; // conta fixa sem parcelas = sempre ativa
  }
  // Verifica se ao menos um mês do ano tem parcela ativa
  for (let m = 1; m <= 12; m++) {
    if (computeInstallment(bill, m, year) !== null) return true;
  }
  return false;
}

function remainingInstallments(bill: FixedBill, fromMonth: number, year: number): number {
  if (!bill.installment_total || bill.installment_start_month == null || bill.installment_start_year == null) return 0;
  const startAbs   = bill.installment_start_year * 12 + bill.installment_start_month - 1;
  const fromAbs    = year * 12 + fromMonth - 1;
  const elapsed    = fromAbs - startAbs; // parcelas já pagas antes do mês de quitação
  return Math.max(0, bill.installment_total - elapsed);
}

interface AccCfg { startMonth: number; startYear: number; saldoInicial: number }

function applyMods(
  base: MonthData[],
  mods: ScenarioMod[],
  bills: FixedBill[],
  year: number,
  startBalance: number = 0,
  cfg?: AccCfg,
): MonthData[] {
  const modified = base.map(row => {
    let receitas   = row.receitas;
    let billsTotal = row.billsTotal;

    for (const mod of mods) {

      switch (mod.type) {
        case "remove_bill": {
          if (row.month < mod.startMonth || row.month > mod.endMonth) break;
          const bill = bills.find(b => b.id === mod.billId);
          if (!bill) break;
          if (bill.installment_total && bill.installment_start_month != null && bill.installment_start_year != null) {
            if (computeInstallment(bill, row.month, year) === null) break;
          }
          billsTotal = Math.max(0, billsTotal - bill.amount);
          break;
        }
        case "pay_off_installment": {
          const bill = bills.find(b => b.id === mod.billId);
          if (!bill) break;
          if (row.month === mod.startMonth) {
            // Usa valor customizado ou calcula automaticamente
            const remaining = remainingInstallments(bill, mod.startMonth, year);
            const cost = mod.payoffAmount != null && mod.payoffAmount > 0
              ? mod.payoffAmount
              : remaining * bill.amount;
            billsTotal += cost;
            // Remove a parcela normal daquele mês (para não dobrar)
            billsTotal = Math.max(0, billsTotal - bill.amount);
          } else if (row.month > mod.startMonth) {
            // Meses seguintes: remove a parcela (já foi quitado)
            if (bill.installment_total && bill.installment_start_month != null && bill.installment_start_year != null) {
              if (computeInstallment(bill, row.month, year) !== null) {
                billsTotal = Math.max(0, billsTotal - bill.amount);
              }
            } else {
              billsTotal = Math.max(0, billsTotal - bill.amount);
            }
          }
          break;
        }
        case "add_expense":      if (row.month >= mod.startMonth && row.month <= mod.endMonth) billsTotal += mod.amount; break;
        case "income_change":    if (row.month >= mod.startMonth && row.month <= mod.endMonth) receitas   += mod.amount; break;
        case "one_time_income":  if (row.month === mod.startMonth) receitas   += mod.amount; break;
        case "one_time_expense": if (row.month === mod.startMonth) billsTotal += mod.amount; break;
        case "loan": {
          if (!mod.amount || !mod.loanInstallments || mod.loanRate == null) break;
          const rows = calculateAmortization({
            amount: mod.amount,
            monthlyRate: mod.loanRate / 100,
            installments: mod.loanInstallments,
            method: mod.loanMethod ?? "price",
            startMonth: mod.startMonth,
            startYear: year,
          });
          if (row.month === mod.startMonth) {
            receitas += mod.amount;
          }
          const loanRow = rows.find(r => r.month === row.month && r.year === year);
          if (loanRow) {
            billsTotal += loanRow.payment;
          }
          break;
        }
      }
    }

    const despesas = billsTotal + row.cartoes;
    return { ...row, receitas, billsTotal, despesas, saldo: receitas - despesas };
  });

  let acc = startBalance;
  return modified.map(m => {
    if (cfg && year === cfg.startYear && m.month < cfg.startMonth) {
      return { ...m, saldoAcumulado: 0 };
    }
    acc += m.saldo;
    return { ...m, saldoAcumulado: acc };
  });
}

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

  const [scenarioName, setScenarioName] = useState("Meu Cenário");
  const [mods, setMods]     = useState<ScenarioMod[]>([]);
  const [yearStartBalance, setYearStartBalance] = useState(0);
  const [accCfg, setAccCfg] = useState<AccCfg>(() => getAccConfig());

  // Persist scenario
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { const p = JSON.parse(saved); setScenarioName(p.name ?? "Meu Cenário"); setMods(p.mods ?? []); }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: scenarioName, mods })); } catch {}
  }, [scenarioName, mods]);

  useEffect(() => { loadYear(); }, [year]);

  async function loadYear() {
    setLoading(true);
    try {
      const [allBills, sources] = await Promise.all([getFixedBills(), getIncomeSources()]);
      setBills(allBills);
      const cfg = getAccConfig();
      setAccCfg(cfg);

      // Carry-over: saldoInicial + saldo acumulado de anos anteriores
      let startBal = cfg.saldoInicial;
      if (year > cfg.startYear) {
        const prevEntries: { m: number; y: number }[] = [];
        for (let y = cfg.startYear; y < year; y++) {
          const fromM = y === cfg.startYear ? cfg.startMonth : 1;
          for (let m = fromM; m <= 12; m++) prevEntries.push({ m, y });
        }
        const prevSaldos = await Promise.all(
          prevEntries.map(async ({ m, y: py }) => {
            const [inc, bp, txs] = await Promise.all([
              getMonthlyIncomes(m, py),
              getMonthlyBillPayments(m, py),
              getCardTransactions(m, py),
            ]);
            const rec = sources.reduce((s, src) => {
              const mi = inc.find((x: any) => x.source_id === src.id);
              if (src.is_recurring === false) {
                if (src.one_time_month !== m || src.one_time_year !== py) return s;
                return s + (mi?.amount ?? src.base_amount);
              }
              return s + (mi?.amount ?? src.base_amount);
            }, 0);
            const paidIds = bp.map((b: any) => b.bill_id);
            const missing = allBills.filter(b => {
              if (paidIds.includes(b.id)) return false;
              if (!b.installment_total) return true;
              if (b.installment_start_month == null || b.installment_start_year == null) return true;
              return computeInstallment(b, m, py) !== null;
            });
            const billsTotal = [
              ...bp.map((b: any) => b.amount ?? b.fixed_bills?.amount ?? 0),
              ...missing.map((b: any) => b.amount),
            ].reduce((s: number, v: number) => s + v, 0);
            const cartoes = txs.reduce((s: number, t: any) => s - t.amount, 0);
            return rec - billsTotal - cartoes;
          })
        );
        startBal += prevSaldos.reduce((s, v) => s + v, 0);
      }
      setYearStartBalance(startBal);

      const rawMonths = await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
          const month = i + 1;
          const [incomes, billPays, txs] = await Promise.all([
            getMonthlyIncomes(month, year),
            getMonthlyBillPayments(month, year),
            getCardTransactions(month, year),
          ]);

          const receitas = sources.reduce((s, src) => {
            const mi = incomes.find(x => x.source_id === src.id);
            if (src.is_recurring === false) {
              if (src.one_time_month !== month || src.one_time_year !== year) return s;
              return s + (mi?.amount ?? src.base_amount);
            }
            return s + (mi?.amount ?? src.base_amount);
          }, 0);

          const paidIds = billPays.map(b => b.bill_id);
          const missing = allBills.filter(b => {
            if (paidIds.includes(b.id)) return false;
            if (!b.installment_total) return true;
            if (b.installment_start_month == null || b.installment_start_year == null) return true;
            return computeInstallment(b, month, year) !== null;
          });
          const billsTotal = [
            ...billPays.map(b => b.amount ?? b.fixed_bills?.amount ?? 0),
            ...missing.map(b => b.amount),
          ].reduce((s, v) => s + v, 0);
          const cartoes = txs.reduce((s, t) => s - t.amount, 0);

          return { month, name: MONTH_SHORT[i], receitas, billsTotal, cartoes, despesas: billsTotal + cartoes, saldo: receitas - billsTotal - cartoes, saldoAcumulado: 0 };
        })
      );

      let acc = startBal;
      setBaseData(rawMonths.map(m => {
        if (year === cfg.startYear && m.month < cfg.startMonth) {
          return { ...m, saldoAcumulado: 0 };
        }
        acc += m.saldo;
        return { ...m, saldoAcumulado: acc };
      }));
    } finally { setLoading(false); }
  }

  // Derived
  const scenarioData = applyMods(baseData, mods, bills, year, yearStartBalance, accCfg);

  const totBase = {
    receitas: baseData.reduce((s, d) => s + d.receitas, 0),
    despesas: baseData.reduce((s, d) => s + d.despesas, 0),
    saldoFinal: baseData[11]?.saldoAcumulado ?? 0,
  };
  const totScen = {
    receitas: scenarioData.reduce((s, d) => s + d.receitas, 0),
    despesas: scenarioData.reduce((s, d) => s + d.despesas, 0),
    saldoFinal: scenarioData[11]?.saldoAcumulado ?? 0,
  };
  const delta = {
    receitas:   totScen.receitas   - totBase.receitas,
    despesas:   totScen.despesas   - totBase.despesas,
    saldoFinal: totScen.saldoFinal - totBase.saldoFinal,
  };

  const chartData = baseData.map((row, i) => ({
    name: row.name,
    Atual: Math.round(row.saldoAcumulado),
    [scenarioName]: Math.round(scenarioData[i]?.saldoAcumulado ?? 0),
  }));

  const hasMods = mods.some(m => {
    if (m.type === "remove_bill") return !!m.billId;
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
              />
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
                {mods.map((mod, idx) => {
                  const isOneTime = mod.type === "one_time_income" || mod.type === "one_time_expense";
                  return (
                    <div key={mod.id} className="border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/20 space-y-2.5">

                      {/* Header: número + tipo + delete */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary-500 w-5 shrink-0">#{idx + 1}</span>
                        <select
                          value={mod.type}
                          onChange={e => {
                            const type = e.target.value as ModType;
                            const isOT = type === "one_time_income" || type === "one_time_expense";
                            updateMod(mod.id, { type, endMonth: isOT ? mod.startMonth : 12 });
                          }}
                          className="flex-1 text-xs font-medium bg-white dark:bg-slate-700
                                     border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5
                                     text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          {(Object.entries(MOD_LABELS) as [ModType, string][]).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeMod(mod.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Exemplo hint */}
                      <p className="text-xs text-slate-400 pl-7">{MOD_EXAMPLES[mod.type]}</p>

                      {/* Campos dinâmicos */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7">

                        {/* Empréstimo */}
                        {mod.type === "loan" && (
                          <>
                            <div>
                              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Valor do emprestimo (R$)</label>
                              <input
                                type="number" step="100"
                                value={mod.amount || ""}
                                onChange={e => updateMod(mod.id, { amount: parseFloat(e.target.value) || 0 })}
                                placeholder="10000"
                                className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                                           rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Taxa mensal (%)</label>
                              <input
                                type="number" step="0.1"
                                value={mod.loanRate ?? ""}
                                onChange={e => updateMod(mod.id, { loanRate: parseFloat(e.target.value) || 0 })}
                                placeholder="2.0"
                                className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                                           rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Parcelas</label>
                              <input
                                type="number" min="1" max="360"
                                value={mod.loanInstallments ?? ""}
                                onChange={e => updateMod(mod.id, { loanInstallments: parseInt(e.target.value) || 0 })}
                                placeholder="12"
                                className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                                           rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Metodo</label>
                              <select
                                value={mod.loanMethod ?? "price"}
                                onChange={e => updateMod(mod.id, { loanMethod: e.target.value as "price" | "sac" })}
                                className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                                           rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              >
                                <option value="price">Price (parcela fixa)</option>
                                <option value="sac">SAC (amortizacao fixa)</option>
                              </select>
                            </div>
                          </>
                        )}

                        {/* Conta (remove_bill) — só mostra contas ativas no ano */}
                        {mod.type === "remove_bill" && (
                          <div className="sm:col-span-1">
                            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Conta a remover</label>
                            <select
                              value={mod.billId}
                              onChange={e => updateMod(mod.id, { billId: e.target.value })}
                              className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                                         rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              <option value="">Selecione…</option>
                              {bills.filter(b => isBillActiveInYear(b, year)).map(b => (
                                <option key={b.id} value={b.id}>
                                  {b.name} ({formatCurrency(b.amount)}/mês)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Quitar parcelamento de uma vez — só mostra contas ativas no ano */}
                        {mod.type === "pay_off_installment" && (() => {
                          const activeBills = bills.filter(b => isBillActiveInYear(b, year));
                          const selectedBill = bills.find(b => b.id === mod.billId);
                          const autoAmount = selectedBill
                            ? remainingInstallments(selectedBill, mod.startMonth, year) * selectedBill.amount
                            : 0;
                          return (
                            <>
                              <div className="sm:col-span-2">
                                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Parcelamento / financiamento a quitar</label>
                                <select
                                  value={mod.billId}
                                  onChange={e => updateMod(mod.id, { billId: e.target.value, payoffAmount: undefined })}
                                  className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                                             rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                >
                                  <option value="">Selecione…</option>
                                  {activeBills.filter(b => b.installment_total).map(b => (
                                    <option key={b.id} value={b.id}>
                                      {b.name} ({formatCurrency(b.amount)}/mês · {b.installment_total}x)
                                    </option>
                                  ))}
                                  {activeBills.filter(b => !b.installment_total).map(b => (
                                    <option key={b.id} value={b.id}>
                                      {b.name} ({formatCurrency(b.amount)}/mês)
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {mod.billId && (
                                <div>
                                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                                    Valor da quitação (R$)
                                    {autoAmount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => updateMod(mod.id, { payoffAmount: undefined })}
                                        className="ml-2 text-primary-500 hover:underline text-[10px]"
                                      >
                                        {mod.payoffAmount != null ? "usar auto" : `auto: ${formatCurrency(autoAmount)}`}
                                      </button>
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    step="100"
                                    value={mod.payoffAmount ?? ""}
                                    placeholder={autoAmount > 0 ? formatCurrency(autoAmount).replace("R$\u00a0", "") : "valor da quitação"}
                                    onChange={e => updateMod(mod.id, {
                                      payoffAmount: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                                    })}
                                    className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                                               rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  />
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {/* Valor (tudo exceto remove_bill, loan e pay_off_installment) */}
                        {mod.type !== "remove_bill" && mod.type !== "loan" && mod.type !== "pay_off_installment" && (
                          <div>
                            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                              {mod.type === "income_change" ? "Valor R$ (+/-)" : "Valor R$"}
                            </label>
                            <input
                              type="number"
                              value={mod.amount || ""}
                              onChange={e => updateMod(mod.id, { amount: parseFloat(e.target.value) || 0 })}
                              placeholder={mod.type === "income_change" ? "+500 ou -200" : "0,00"}
                              className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                                         rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </div>
                        )}

                        {/* De (mês início) */}
                        <div>
                          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                            {isOneTime ? "Mes" : mod.type === "loan" ? "Mes do emprestimo" : mod.type === "pay_off_installment" ? "Mes da quitacao" : "A partir de"}
                          </label>
                          <select
                            value={mod.startMonth}
                            onChange={e => {
                              const v = +e.target.value;
                              updateMod(mod.id, {
                                startMonth: v,
                                endMonth: isOneTime ? v : Math.max(mod.endMonth, v),
                              });
                            }}
                            className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                                       rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            {MONTH_OPTS.map(m => <option key={m} value={m}>{getMonthName(m)}</option>)}
                          </select>
                        </div>

                        {/* Até (mês fim) — oculto para one-time, loan e pay_off */}
                        {!isOneTime && mod.type !== "loan" && mod.type !== "pay_off_installment" && (
                          <div>
                            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Até</label>
                            <select
                              value={mod.endMonth}
                              onChange={e => updateMod(mod.id, { endMonth: +e.target.value })}
                              className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                                         rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              {MONTH_OPTS.filter(m => m >= mod.startMonth).map(m => (
                                <option key={m} value={m}>{getMonthName(m)}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Preview do impacto mensal */}
                      {mod.type === "remove_bill" && mod.billId && (() => {
                        const bill = bills.find(b => b.id === mod.billId);
                        if (!bill) return null;
                        const months = mod.endMonth - mod.startMonth + 1;
                        return (
                          <div className="pl-7 flex gap-4 text-xs">
                            <span className="text-emerald-600 font-semibold">
                              +{formatCurrency(bill.amount)}/mês economizado
                            </span>
                            <span className="text-emerald-500">
                              +{formatCurrency(bill.amount * months)} em {months} mês{months > 1 ? "es" : ""}
                            </span>
                          </div>
                        );
                      })()}
                      {/* Preview: quitar parcelamento */}
                      {mod.type === "pay_off_installment" && mod.billId && (() => {
                        const bill = bills.find(b => b.id === mod.billId);
                        if (!bill) return null;
                        const remaining = remainingInstallments(bill, mod.startMonth, year);
                        const autoTotal = remaining * bill.amount;
                        const totalCost = mod.payoffAmount != null && mod.payoffAmount > 0 ? mod.payoffAmount : autoTotal;
                        const monthsSaved = Math.max(0, 12 - mod.startMonth);
                        const savedInYear = monthsSaved * bill.amount;
                        const isCustom = mod.payoffAmount != null && mod.payoffAmount > 0;
                        return (
                          <div className="pl-7 space-y-1 text-xs">
                            <div className="flex flex-wrap gap-4 items-center">
                              <span className="text-red-500 font-semibold">
                                -{formatCurrency(totalCost)} em {getMonthName(mod.startMonth)}
                                {isCustom && <span className="ml-1 text-amber-500">(valor customizado)</span>}
                              </span>
                              {!isCustom && remaining > 0 && (
                                <span className="text-slate-400">
                                  {remaining} parcelas × {formatCurrency(bill.amount)}
                                </span>
                              )}
                              {isCustom && autoTotal > 0 && (
                                <span className="text-slate-400">auto seria {formatCurrency(autoTotal)}</span>
                              )}
                            </div>
                            {savedInYear > 0 && (
                              <div className="text-emerald-600">
                                +{formatCurrency(savedInYear)} economizado no restante do ano ({monthsSaved} meses sem parcela)
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {/* Loan amortization preview */}
                      {mod.type === "loan" && mod.amount > 0 && (mod.loanInstallments ?? 0) > 0 && (mod.loanRate ?? 0) >= 0 && (() => {
                        const rows = calculateAmortization({
                          amount: mod.amount,
                          monthlyRate: (mod.loanRate ?? 0) / 100,
                          installments: mod.loanInstallments ?? 12,
                          method: mod.loanMethod ?? "price",
                          startMonth: mod.startMonth,
                          startYear: year,
                        });
                        const summary = loanSummary(rows);
                        return (
                          <div className="pl-7 space-y-2">
                            <div className="flex flex-wrap gap-3 text-xs">
                              <span className="text-slate-500">Parcela: <b className="text-red-500">{formatCurrency(summary.firstPayment)}/mes</b></span>
                              {summary.firstPayment !== summary.lastPayment && (
                                <span className="text-slate-500">Ultima: <b className="text-red-500">{formatCurrency(summary.lastPayment)}</b></span>
                              )}
                              <span className="text-slate-500">Total pago: <b className="text-slate-700 dark:text-slate-200">{formatCurrency(summary.totalPaid)}</b></span>
                              <span className="text-slate-500">Juros: <b className="text-amber-600">{formatCurrency(summary.totalInterest)}</b></span>
                            </div>
                            <details className="text-xs">
                              <summary className="cursor-pointer text-primary-600 dark:text-primary-400 font-medium flex items-center gap-1">
                                <Calculator size={11} /> Ver tabela de amortizacao ({rows.length} parcelas)
                              </summary>
                              <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                    <tr>
                                      <th className="text-left px-2 py-1.5 text-slate-500">#</th>
                                      <th className="text-left px-2 py-1.5 text-slate-500">Mes</th>
                                      <th className="text-right px-2 py-1.5 text-slate-500">Parcela</th>
                                      <th className="text-right px-2 py-1.5 text-slate-500">Juros</th>
                                      <th className="text-right px-2 py-1.5 text-slate-500">Amort.</th>
                                      <th className="text-right px-2 py-1.5 text-slate-500">Saldo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map(r => (
                                      <tr key={r.installment} className="border-t border-slate-100 dark:border-slate-700/30">
                                        <td className="px-2 py-1 text-slate-400">{r.installment}</td>
                                        <td className="px-2 py-1 text-slate-600 dark:text-slate-300">{getMonthName(r.month).slice(0,3)}/{r.year}</td>
                                        <td className="px-2 py-1 text-right text-red-500 tabular-nums">{formatCurrency(r.payment)}</td>
                                        <td className="px-2 py-1 text-right text-amber-500 tabular-nums">{formatCurrency(r.interest)}</td>
                                        <td className="px-2 py-1 text-right text-emerald-500 tabular-nums">{formatCurrency(r.principal)}</td>
                                        <td className="px-2 py-1 text-right text-slate-600 dark:text-slate-300 tabular-nums">{formatCurrency(r.remaining)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          </div>
                        );
                      })()}
                      {mod.type !== "remove_bill" && mod.type !== "loan" && mod.amount !== 0 && (() => {
                        const months = isOneTime ? 1 : mod.endMonth - mod.startMonth + 1;
                        const isPositive = mod.type === "income_change" || mod.type === "one_time_income"
                          ? mod.amount > 0
                          : mod.amount < 0;
                        const total = Math.abs(mod.amount) * months;
                        return (
                          <div className="pl-7 flex gap-4 text-xs">
                            <span className={`font-semibold ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
                              {isPositive ? "+" : "-"}{formatCurrency(Math.abs(mod.amount))}/mês
                            </span>
                            {!isOneTime && (
                              <span className={isPositive ? "text-emerald-500" : "text-red-400"}>
                                {isPositive ? "+" : "-"}{formatCurrency(total)} em {months} meses
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
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
              <div className="card">
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1">
                  Saldo Acumulado — Atual vs {scenarioName}
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Linha tracejada = cenário atual · Linha sólida = {scenarioName}
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gAtual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gCenario" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" strokeOpacity={0.8} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={36} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone" dataKey="Atual"
                      stroke="#94a3b8" fill="url(#gAtual)"
                      strokeWidth={1.5} strokeDasharray="6 4" dot={false}
                    />
                    <Area
                      type="monotone" dataKey={scenarioName}
                      stroke="#6366f1" fill="url(#gCenario)"
                      strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
