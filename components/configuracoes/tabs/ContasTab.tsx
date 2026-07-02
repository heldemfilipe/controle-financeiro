"use client";

import { Plus, FileText, Pencil, Trash2 } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { formatCurrency } from "@/lib/utils";
import type { FixedBill } from "@/types";

interface BillGroup {
  key: string;
  label: string;
  bills: FixedBill[];
}

interface ContasTabProps {
  billGroups: BillGroup[];
  listBills: FixedBill[];
  totalMonthlyBills: number;
  onAdd: () => void;
  onEdit: (bill: FixedBill) => void;
  onDelete: (bill: FixedBill) => void;
  onToggleActive: (bill: FixedBill) => void;
}

export function ContasTab({ billGroups, listBills, totalMonthlyBills, onAdd, onEdit, onDelete, onToggleActive }: ContasTabProps) {
  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Contas recorrentes mensais. Organize por período e categoria para melhor controle.
        </p>
        <button onClick={onAdd}
          className="btn-primary flex items-center gap-1.5 shrink-0">
          <Plus size={14} /> Nova Conta
        </button>
      </div>

      <div className="space-y-4">
        {billGroups.map(({ key, label, bills: groupBills }) => (
          <div key={key} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl overflow-hidden transition-colors">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{label}</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  {formatCurrency(groupBills.filter(b => b.active).reduce((s, b) => s + b.amount, 0))}
                </span>
              </div>
            </div>
            <div>
              {groupBills.map((bill) => (
                <div key={bill.id}
                  className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 dark:border-slate-700/30 last:border-0 ${
                    !bill.active ? "opacity-50" : ""
                  }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      bill.category === "essencial"
                        ? "bg-primary-50 dark:bg-primary-900/20"
                        : "bg-amber-50 dark:bg-amber-900/20"
                    }`}>
                      <FileText size={13} className={
                        bill.category === "essencial"
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-amber-600 dark:text-amber-400"
                      } />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{bill.name}</p>
                        {!bill.active && (
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full shrink-0">
                            inativa
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {bill.due_day && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">Dia {bill.due_day}</span>
                        )}
                        {bill.installment_current && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            · Parcela {bill.installment_current}/{bill.installment_total}
                          </span>
                        )}
                        {bill.notes && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">· {bill.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 shrink-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(bill.amount)}</p>
                    <Toggle size="sm" checked={bill.active} onChange={() => onToggleActive(bill)} />
                    <div className="flex gap-1">
                      <button onClick={() => onEdit(bill)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <Pencil size={13} className="text-slate-400 dark:text-slate-500" />
                      </button>
                      <button
                        onClick={() => onDelete(bill)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {listBills.length === 0 && (
          <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-8 text-center transition-colors">
            <FileText size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">Nenhuma conta fixa cadastrada</p>
            <button onClick={onAdd}
              className="btn-primary">Adicionar Conta</button>
          </div>
        )}
      </div>

      {listBills.length > 0 && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-xl p-3 flex justify-between transition-colors">
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">Total Mensal (contas ativas)</span>
          <span className="text-lg font-bold text-red-700 dark:text-red-400">{formatCurrency(totalMonthlyBills)}</span>
        </div>
      )}
    </div>
  );
}
