"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { CategoryBadge } from "@/components/lancamentos/CategoryBadge";
import { TotalSummaryCard } from "@/components/lancamentos/TotalSummaryCard";
import { formatCurrency, computeInstallment } from "@/lib/utils";
import type { FixedBill, Category, BillPeriod } from "@/types";

interface ContasTabProps {
  fixedBills: FixedBill[];
  categories: Category[];
  month: number;
  year: number;
  onAdd: () => void;
  onAddForPeriod: (period: BillPeriod | null) => void;
  onEdit: (bill: FixedBill) => void;
  onDelete: (bill: FixedBill) => void;
}

export function ContasTab({ fixedBills, categories, month, year, onAdd, onAddForPeriod, onEdit, onDelete }: ContasTabProps) {
  const [billGroupMode, setBillGroupMode] = useState<"quinzena" | "categoria">("quinzena");

  // Filtra contas fora do range ativo de parcelas para o mês selecionado
  const visibleBills = fixedBills.filter(bill => {
    if (!bill.installment_total) return true;
    if (bill.installment_start_month == null || bill.installment_start_year == null) return true;
    return computeInstallment(bill, month, year) !== null;
  });

  // Agrupamento: por quinzena (padrão) ou por categoria
  const billsByGroup = (() => {
    const sortByDueDay = (a: FixedBill, b: FixedBill) =>
      (a.due_day ?? 99) - (b.due_day ?? 99);

    if (billGroupMode === "quinzena") {
      const periods: [string | null, string][] = [
        ["1-15",  "1ª Quinzena"],
        ["16-30", "2ª Quinzena"],
        [null,    "Sem período"],
      ];
      return periods
        .map(([key, label]) => ({
          key,
          label,
          bills: visibleBills
            .filter(b => (b.period ?? null) === key)
            .sort(sortByDueDay),
        }))
        .filter(g => g.bills.length > 0);
    } else {
      // Agrupa por categoria × período
      const groups: { key: string | null; label: string; bills: FixedBill[] }[] = [];
      const periods: [string | null, string][] = [
        ["1-15",  "1ª Quinzena"],
        ["16-30", "2ª Quinzena"],
        [null,    "Sem período"],
      ];
      periods.forEach(([key, periodLabel]) => {
        const periodBills = visibleBills.filter(b => (b.period ?? null) === key);
        const cats = Array.from(new Set(periodBills.map(b => b.category || "outros")));
        cats.forEach(cat => {
          const bills = periodBills
            .filter(b => (b.category || "outros") === cat)
            .sort(sortByDueDay);
          if (bills.length > 0) {
            const label = key
              ? `${cat.charAt(0).toUpperCase() + cat.slice(1)} · ${periodLabel}`
              : periodLabel;
            groups.push({ key, label, bills });
          }
        });
      });
      return groups;
    }
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Contas</h2>
          {/* Toggle: por quinzena / por categoria */}
          <div className="flex bg-slate-100 dark:bg-slate-700/60 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setBillGroupMode("quinzena")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                billGroupMode === "quinzena"
                  ? "bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Quinzena
            </button>
            <button
              onClick={() => setBillGroupMode("categoria")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                billGroupMode === "categoria"
                  ? "bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Categoria
            </button>
          </div>
        </div>
        <button
          onClick={onAdd}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus size={14} /> Nova Conta
        </button>
      </div>

      <div className="space-y-4">
        {billsByGroup.map(({ key, label, bills }) => (
          <div key={label} className="card transition-colors">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {label}
              </h3>
              <button
                onClick={() => onAddForPeriod(key as BillPeriod | null)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                title={`Nova conta — ${label}`}
              >
                <Plus size={11} /> Nova
              </button>
            </div>
            <div className="space-y-0">
              {bills.map((bill) => (
                <div key={bill.id}
                  className="flex items-center justify-between py-2.5 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{bill.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {bill.due_day ? `Vence dia ${bill.due_day}` : "Sem vencimento"}
                      {(() => {
                        if (!bill.installment_total) return null;
                        const inst = computeInstallment(bill, month, year);
                        if (inst) return ` · ${inst.current}/${inst.total}x`;
                        if (bill.installment_current) return ` · ${bill.installment_current}/${bill.installment_total}x`;
                        return null;
                      })()}
                      {bill.notes && ` · ${bill.notes}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatCurrency(bill.amount)}
                    </span>
                    <CategoryBadge category={bill.category} categories={categories} size="md" fallback="Outros" />
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEdit(bill)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <Pencil size={13} className="text-slate-400 dark:text-slate-500" />
                      </button>
                      <button
                        onClick={() => onDelete(bill)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Subtotal</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {formatCurrency(bills.reduce((s, b) => s + b.amount, 0))}
              </span>
            </div>
          </div>
        ))}
      </div>

      <TotalSummaryCard
        label="Total Contas"
        value={visibleBills.reduce((s, b) => s + b.amount, 0)}
        variant="primary"
      />
    </div>
  );
}
