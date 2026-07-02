"use client";

import { Settings, Sliders } from "lucide-react";
import { formatCurrency, getMonthName } from "@/lib/utils";
import type { MonthlyBalanceOverride } from "@/types";

interface FluxoCaixaProps {
  prevBalance: number;
  balance: number;
  balanceOverride: MonthlyBalanceOverride | null;
  q1Income: number;
  q1Total: number;
  q2Income: number;
  q2Total: number;
  month: number;
  year: number;
  onOpenAccConfig: () => void;
  onAdjustBalance: () => void;
}

export function FluxoCaixa({
  prevBalance, balance, balanceOverride, q1Income, q1Total, q2Income, q2Total,
  month, year, onOpenAccConfig, onAdjustBalance,
}: FluxoCaixaProps) {
  const accBalance = prevBalance + balance;
  const overrideValue = balanceOverride
    ? (balanceOverride.auto_zero ? 0 : balanceOverride.override_amount)
    : null;
  const displayBalance = overrideValue !== null ? overrideValue : accBalance;
  // Saldo após a 1ª quinzena: saldo anterior + receitas da 1ª quinzena - despesas da 1ª quinzena
  const saldoMeio  = prevBalance + q1Income - q1Total;

  function FlowRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
    const pos = value >= 0;
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className={`text-xs ${muted ? "text-slate-400 dark:text-slate-500" : "text-slate-500 dark:text-slate-400"}`}>{label}</span>
        <span className={`text-sm font-semibold ${muted ? "text-slate-400 dark:text-slate-500" : pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
          {pos ? "+" : ""}{formatCurrency(value)}
        </span>
      </div>
    );
  }

  function Mid({ label, value }: { label: string; value: number }) {
    const pos = value >= 0;
    return (
      <div className={`flex items-center justify-between px-3 py-1.5 -mx-4 border-y ${
        pos ? "bg-emerald-50/70 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30"
            : "bg-red-50/70 dark:bg-red-900/20 border-red-100 dark:border-red-800/30"
      }`}>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`text-sm font-bold ${pos ? "text-emerald-600" : "text-red-500"}`}>
          {pos ? "+" : ""}{formatCurrency(value)}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 pt-3 pb-4 mb-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
          Fluxo de Caixa · {getMonthName(month)} {year}
        </span>
        <button
          onClick={onOpenAccConfig}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          title="Configurar saldo acumulado"
        >
          <Settings size={12} className="text-slate-400 dark:text-slate-500" />
        </button>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {prevBalance !== 0 && <FlowRow label="Saldo anterior" value={prevBalance} muted />}
        {q1Income > 0 && <FlowRow label="Receitas 1ª Quinzena" value={q1Income} />}
        <FlowRow label="1ª Quinzena (dias 1–15)" value={-q1Total} />
      </div>

      <Mid label="Pós 1ª quinzena" value={saldoMeio} />

      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {q2Income > 0 && <FlowRow label="Receitas 2ª Quinzena" value={q2Income} />}
        <FlowRow label="2ª Quinzena (dias 16–30)" value={-q2Total} />
      </div>

      {/* Saldo final */}
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl mt-3 border ${
        displayBalance >= 0
          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30"
          : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Saldo final</p>
            {balanceOverride && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 font-medium">
                {balanceOverride.auto_zero ? "Zerado" : "Ajustado"}
              </span>
            )}
          </div>
          {balanceOverride ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Calculado: {accBalance >= 0 ? "+" : ""}{formatCurrency(accBalance)}
            </p>
          ) : prevBalance !== 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Mês: {balance >= 0 ? "+" : ""}{formatCurrency(balance)}
            </p>
          )}
          {balanceOverride?.notes && (
            <p className="text-xs text-violet-500 italic mt-0.5">{balanceOverride.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold ${displayBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {displayBalance >= 0 ? "+" : ""}{formatCurrency(displayBalance)}
          </span>
          <button
            onClick={onAdjustBalance}
            title="Ajustar saldo deste mês"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Sliders size={13} className="text-violet-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
