"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { StatusIcon } from "@/components/gastos-mensais/StatusIcon";
import { formatCurrency } from "@/lib/utils";
import { hasTitheBreakdown, type TitheBreakdown } from "@/lib/gastos-mensais/tithe";
import type { FixedBill, MonthlyBillPayment } from "@/types";

const VIEW_KEY = "tithe-view";

interface TitheSectionProps {
  titheBill: FixedBill | undefined;
  billSt: (bill: FixedBill) => "paid" | "overdue" | "pending";
  incomeTotal: number;
  titheDisplayAmt: number;
  tithePayment: MonthlyBillPayment | undefined;
  tithe: TitheBreakdown;
  month: number;
  year: number;
  onEdit: (bill: FixedBill) => void;
  onToggle: (bill: FixedBill, paid: boolean) => void;
}

export function TitheSection({
  titheBill, billSt, incomeTotal, titheDisplayAmt, tithePayment, tithe, month, year, onEdit, onToggle,
}: TitheSectionProps) {
  const [savedView, setView] = useState<"owner" | "source">("owner");

  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "source") setView("source");
    } catch {}
  }, []);

  function changeView(v: "owner" | "source") {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  }

  if (!titheBill) return null;

  const canBreakdown = hasTitheBreakdown(month, year);
  const isEdited = Math.abs(titheDisplayAmt - tithe.total) > 0.005;
  const view = canBreakdown ? savedView : "owner";

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

      {/* Valor editado no mês: mostra o recomendado (10%) */}
      {isEdited && (
        <p className="text-xs text-violet-600 dark:text-violet-400 mb-3">
          Valor ajustado neste mês · recomendado (10%): {formatCurrency(tithe.total)}
        </p>
      )}

      {/* Seletor de visão (a partir de nov/2026) */}
      {canBreakdown && (
        <div className="flex gap-1 mb-2">
          {([["owner", "Por pessoa"], ["source", "Por renda"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => changeView(key)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                view === key
                  ? "bg-violet-600 text-white"
                  : "bg-white/60 dark:bg-slate-800/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-800/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Breakdown por owner ou por fonte de renda (dinâmico) */}
      {(() => {
        const entries = view === "source"
          ? tithe.bySource.filter(s => s.base > 0).map(s => ({ key: s.id, label: s.name, base: s.base, value: s.tithe }))
          : Object.entries(tithe.byOwner).filter(([, v]) => v.base > 0)
              .map(([owner, v]) => ({ key: owner, label: owner, base: v.base, value: v.tithe }));
        const cols = entries.length >= 3 ? "grid-cols-3" : entries.length === 2 ? "grid-cols-2" : "grid-cols-1";
        return (
          <div className={`grid gap-2 ${cols}`}>
            {entries.map(({ key, label, base, value }) => (
              <div key={key} className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-2.5">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 capitalize">{label}</p>
                <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
                  {formatCurrency(value)}
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
