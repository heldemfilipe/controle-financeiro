"use client";

import { Pencil } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { StatusIcon } from "@/components/gastos-mensais/StatusIcon";
import { formatCurrency } from "@/lib/utils";
import type { FixedBill, MonthlyBillPayment } from "@/types";

interface TitheSectionProps {
  titheBill: FixedBill | undefined;
  billSt: (bill: FixedBill) => "paid" | "overdue" | "pending";
  incomeTotal: number;
  titheDisplayAmt: number;
  tithePayment: MonthlyBillPayment | undefined;
  tithe: { byOwner: Record<string, { base: number; tithe: number }>; total: number };
  onEdit: (bill: FixedBill) => void;
  onToggle: (bill: FixedBill, paid: boolean) => void;
}

export function TitheSection({
  titheBill, billSt, incomeTotal, titheDisplayAmt, tithePayment, tithe, onEdit, onToggle,
}: TitheSectionProps) {
  if (!titheBill) return null;

  const status = billSt(titheBill);

  return (
    <div className="mb-6 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800/30 rounded-xl p-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <StatusIcon status={status} />
          <div>
            <h2 className="text-sm font-bold text-violet-800 dark:text-violet-300">
              Dízimo — 10% da Renda
            </h2>
            <p className="text-xs text-violet-600 dark:text-violet-400">
              10% sobre {formatCurrency(incomeTotal)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-base font-bold text-violet-800 dark:text-violet-200">
                {formatCurrency(titheDisplayAmt)}
              </span>
              <button
                onClick={() => onEdit(titheBill)}
                title="Editar valor do dízimo"
                className="p-1 hover:bg-violet-100 dark:hover:bg-violet-800/40 rounded transition-colors"
              >
                <Pencil size={11} className="text-violet-500" />
              </button>
            </div>
            {tithePayment?.paid && (
              <p className="text-xs text-emerald-600">✓ Pago</p>
            )}
          </div>
          <Toggle
            checked={tithePayment?.paid ?? false}
            onChange={v => onToggle(titheBill, v)}
          />
        </div>
      </div>

      {/* Breakdown por owner (dinâmico) */}
      {(() => {
        const entries = Object.entries(tithe.byOwner).filter(([, v]) => v.base > 0);
        const cols = entries.length >= 3 ? "grid-cols-3" : entries.length === 2 ? "grid-cols-2" : "grid-cols-1";
        return (
          <div className={`grid gap-2 ${cols}`}>
            {entries.map(([owner, { base, tithe: ownerTithe }]) => (
              <div key={owner} className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-2.5">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 capitalize">{owner}</p>
                <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
                  {formatCurrency(ownerTithe)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  10% de {formatCurrency(base)}
                </p>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
