"use client";

import { Plus, Pencil, Trash2, TrendingUp, CalendarClock, CalendarX, CalendarPlus } from "lucide-react";
import { TotalSummaryCard } from "@/components/lancamentos/TotalSummaryCard";
import { MONTHS } from "@/types";
import { formatCurrency, resolveSourceAmount } from "@/lib/utils";
import type { IncomeSource, IncomeSourceAmount, MonthlyIncome } from "@/types";
import type { Owner } from "@/lib/owners";

interface ReceitasTabProps {
  incomeSources: IncomeSource[];
  monthlyIncomes: MonthlyIncome[];
  sourceAmounts: IncomeSourceAmount[];
  owners: Owner[];
  month: number;
  year: number;
  onAdd: () => void;
  onEdit: (src: IncomeSource) => void;
  onDelete: (src: IncomeSource) => void;
  onAdjustMonth: (src: IncomeSource) => void;
}

export function ReceitasTab({
  incomeSources, monthlyIncomes, sourceAmounts, owners, month, year, onAdd, onEdit, onDelete, onAdjustMonth,
}: ReceitasTabProps) {
  const total = incomeSources.reduce((s, src) => {
    const mi = monthlyIncomes.find(m => m.source_id === src.id);
    return s + (mi?.amount ?? resolveSourceAmount(src, month, year, sourceAmounts));
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Fontes de Renda</h2>
        <button
          onClick={onAdd}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus size={14} /> Nova Fonte
        </button>
      </div>

      <div className="card transition-colors">
        {incomeSources.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8">
            Nenhuma fonte cadastrada
          </p>
        ) : (
          <div className="space-y-0">
            {incomeSources.map((src) => {
              const mi = monthlyIncomes.find(m => m.source_id === src.id);
              const defaultAmt = resolveSourceAmount(src, month, year, sourceAmounts);
              const effectiveAmt = mi?.amount ?? defaultAmt;
              const isOverridden = mi != null && mi.amount !== defaultAmt;
              const isSkipped = isOverridden && mi!.amount === 0;
              return (
                <div key={src.id}
                  className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center shrink-0">
                      <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{src.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {src.due_day ? `Dia ${src.due_day}` : "Sem data fixa"} · {owners.find(o => o.id === src.owner)?.name ?? src.owner}
                      </p>
                      {isOverridden && (
                        <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          isSkipped
                            ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>
                          {isSkipped ? <CalendarX size={10} /> : <CalendarClock size={10} />}
                          {isSkipped
                            ? `Sem recebimento em ${MONTHS[month - 1]}`
                            : `Ajustado em ${MONTHS[month - 1]} · padrão ${formatCurrency(defaultAmt)}`}
                        </span>
                      )}
                      {src.is_recurring !== false && src.start_month != null && src.start_year != null && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                          <CalendarPlus size={10} />
                          Recorrente desde {MONTHS[src.start_month - 1]}/{src.start_year}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className={`text-sm font-semibold ${
                      isSkipped ? "text-red-500 line-through" : "text-emerald-700 dark:text-emerald-400"
                    }`}>
                      {formatCurrency(effectiveAmt)}
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onAdjustMonth(src)}
                        title={`Ajustar valor de ${MONTHS[month - 1]}`}
                        className={`p-1.5 rounded-lg ${
                          isOverridden
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100"
                            : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        <CalendarClock size={13} />
                      </button>
                      <button
                        onClick={() => onEdit(src)}
                        title="Editar fonte de renda"
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <Pencil size={13} className="text-slate-400 dark:text-slate-500" />
                      </button>
                      <button
                        onClick={() => onDelete(src)}
                        title="Excluir fonte de renda"
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TotalSummaryCard label="Total Receitas" value={total} variant="emerald" />
    </div>
  );
}
