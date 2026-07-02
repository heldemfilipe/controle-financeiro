"use client";

import { Pencil, ChevronsRight } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { StatusIcon } from "@/components/gastos-mensais/StatusIcon";
import { formatCurrency, getDueInfo, computeInstallment } from "@/lib/utils";
import type { DueInfo } from "@/lib/utils";
import { MONTHS } from "@/types";
import type { FixedBill, MonthlyBillPayment, BillAdvance } from "@/types";

interface BillRowProps {
  bill: FixedBill;
  advancesForThisMonth: BillAdvance[];
  billPayments: MonthlyBillPayment[];
  billSt: (bill: FixedBill) => "paid" | "overdue" | "pending";
  billAmount: (bill: FixedBill) => number;
  month: number;
  year: number;
  onAdvance: (bill: FixedBill) => void;
  onEdit: (bill: FixedBill) => void;
  onToggle: (bill: FixedBill, paid: boolean) => void;
}

export function BillRow({
  bill, advancesForThisMonth, billPayments, billSt, billAmount, month, year, onAdvance, onEdit, onToggle,
}: BillRowProps) {
  const advance  = advancesForThisMonth.find(a => a.bill_id === bill.id);
  const isAdvanced = !!advance;

  const status  = isAdvanced ? "paid" : billSt(bill);
  const amount  = billAmount(bill);
  const payment = billPayments.find(p => p.bill_id === bill.id);
  const dueInfo: DueInfo | null = (status === "pending" && !isAdvanced) ? getDueInfo(bill.due_day, month, year) : null;

  const isUrgent = dueInfo && (dueInfo.urgency === "today" || dueInfo.urgency === "tomorrow" || dueInfo.urgency === "soon");

  // Cor do card conforme situação de vencimento
  const rowBg = isAdvanced
    ? "bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/30"
    : status === "overdue"
      ? "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40"
      : isUrgent
      ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40"
      : "bg-white dark:bg-slate-800";

  const dueTextColor =
    status === "overdue"                           ? "text-red-500 dark:text-red-400" :
    dueInfo?.urgency === "today"                   ? "text-red-500 dark:text-red-400" :
    dueInfo?.urgency === "tomorrow"                ? "text-amber-600 dark:text-amber-400" :
    dueInfo?.urgency === "soon"                    ? "text-amber-600 dark:text-amber-400" :
    dueInfo?.urgency === "later"                   ? "text-slate-500 dark:text-slate-400" :
                                                     "text-slate-400 dark:text-slate-500";

  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 shadow-sm gap-2 ${rowBg}`}>
      <div className="flex items-center gap-2 min-w-0">
        <StatusIcon status={status} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{bill.name}</p>
            {isAdvanced && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-medium shrink-0">
                Adiantado
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isAdvanced ? (
              <span className="text-xs text-violet-500 dark:text-violet-400">
                Pago em {MONTHS[advance.paid_month - 1]}/{advance.paid_year}
              </span>
            ) : (
              <>
                {bill.due_day && (
                  <span className={`text-xs ${dueTextColor}`}>
                    dia {bill.due_day}
                    {dueInfo && ` · ${dueInfo.label}`}
                  </span>
                )}
                {(() => {
                  const inst = computeInstallment(bill, month, year);
                  return inst ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      · {inst.current}/{inst.total}x
                    </span>
                  ) : null;
                })()}
                {payment?.notes && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 italic truncate max-w-[100px]">
                    {payment.notes}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <span className={`text-sm font-semibold ${isAdvanced ? "text-violet-500 dark:text-violet-400 line-through" : "text-red-600 dark:text-red-400"}`}>
              -{formatCurrency(amount)}
            </span>
            {!isAdvanced && (
              <>
                <button
                  onClick={() => onAdvance(bill)}
                  title="Adiantar pagamento para próximo mês"
                  className="p-0.5 hover:bg-violet-100 dark:hover:bg-violet-800/40 rounded transition-colors"
                >
                  <ChevronsRight size={10} className="text-violet-400 dark:text-violet-500" />
                </button>
                <button
                  onClick={() => onEdit(bill)}
                  title="Editar valor deste mês"
                  className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                >
                  <Pencil size={10} className="text-slate-400 dark:text-slate-500" />
                </button>
              </>
            )}
          </div>
          {status === "overdue" && !payment?.paid && !isAdvanced && dueInfo && (
            <span className="text-xs text-red-500 font-medium">{dueInfo.label}</span>
          )}
          {status === "overdue" && !payment?.paid && !isAdvanced && !dueInfo && (
            <span className="text-xs text-red-500 font-medium">Vencida!</span>
          )}
        </div>
        <Toggle
          checked={isAdvanced || (payment?.paid ?? false)}
          onChange={v => !isAdvanced && onToggle(bill, v)}
          disabled={isAdvanced}
        />
      </div>
    </div>
  );
}
