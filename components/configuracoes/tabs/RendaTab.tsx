"use client";

import { Plus, User, History, Pencil, Trash2, Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { IncomeSource } from "@/types";
import type { Owner } from "@/lib/owners";

interface RendaTabProps {
  sources: IncomeSource[];
  owners: Owner[];
  totalMonthlyIncome: number;
  onAdd: () => void;
  onEdit: (src: IncomeSource) => void;
  onDelete: (src: IncomeSource) => void;
  onHistory: (src: IncomeSource) => void;
}

export function RendaTab({ sources, owners, totalMonthlyIncome, onAdd, onEdit, onDelete, onHistory }: RendaTabProps) {
  const recurring = sources.filter(s => s.is_recurring !== false);

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure suas fontes de renda fixas. Elas serão usadas como base para cada mês.
        </p>
        <button onClick={onAdd}
          className="btn-primary flex items-center gap-1.5 shrink-0">
          <Plus size={14} /> Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {recurring.map((src) => (
          <div key={src.id}
            className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-4 flex items-center justify-between hover:border-slate-200 dark:hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              {(() => {
                const o = owners.find(ow => ow.id === src.owner);
                const color = o?.color ?? "#94a3b8";
                const ownerLabel = o?.name ?? src.owner;
                return (
                  <>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}22` }}>
                      <User size={15} style={{ color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">{src.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${color}18`, color }}>
                          {ownerLabel}
                        </span>
                        <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                          {src.type === "salary" ? "Salário" : src.type === "extra" ? "Extra" : "Outro"}
                        </span>
                        {src.due_day && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">Dia {src.due_day}</span>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(src.base_amount)}</p>
              <div className="flex gap-1">
                <button onClick={() => onHistory(src)}
                  title="Histórico de valores"
                  className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors">
                  <History size={14} className="text-amber-500" />
                </button>
                <button onClick={() => onEdit(src)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <Pencil size={14} className="text-slate-400 dark:text-slate-500" />
                </button>
                <button
                  onClick={() => onDelete(src)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {recurring.length === 0 && (
          <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-8 text-center transition-colors">
            <Banknote size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">Nenhuma fonte de renda cadastrada</p>
            <button onClick={onAdd}
              className="btn-primary">Adicionar Fonte</button>
          </div>
        )}
      </div>

      {recurring.length > 0 && (
        <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-3 flex justify-between transition-colors">
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Renda Mensal Total</span>
          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalMonthlyIncome)}</span>
        </div>
      )}
    </div>
  );
}
