"use client";

import { CreditCard, ChevronDown, ChevronRight } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { CategoryBadge } from "@/components/lancamentos/CategoryBadge";
import { formatCurrency, getDueInfo } from "@/lib/utils";
import type { DueInfo } from "@/lib/utils";
import type { CreditCard as CCType, MonthlyCardPayment, CardTransaction, Category } from "@/types";

interface CardRowProps {
  card: CCType;
  cardTotals: Record<string, number>;
  cardSt: (card: CCType) => "paid" | "overdue" | "pending";
  cardPayments: MonthlyCardPayment[];
  cardTransactions: CardTransaction[];
  categories: Category[];
  expandedCard: string | null;
  onExpandCard: (cardId: string | null) => void;
  month: number;
  year: number;
  incomeTotal: number;
  onToggle: (card: CCType, paid: boolean) => void;
}

export function CardRow({
  card, cardTotals, cardSt, cardPayments, cardTransactions, categories, expandedCard, onExpandCard,
  month, year, incomeTotal, onToggle,
}: CardRowProps) {
  const total    = cardTotals[card.id] ?? 0;
  const status   = cardSt(card);
  const payment  = cardPayments.find(p => p.card_id === card.id);
  const txs      = cardTransactions.filter(t => t.card_id === card.id);
  const isOpen   = expandedCard === card.id;
  const dueInfo: DueInfo | null = status === "pending" && total > 0 ? getDueInfo(card.due_day, month, year) : null;
  const isUrgent = dueInfo && (dueInfo.urgency === "today" || dueInfo.urgency === "tomorrow" || dueInfo.urgency === "soon");
  const parcelCount = txs.filter(t => t.installment_total > 1).length;

  const cardBg = total > 0 && status === "overdue"
    ? "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40"
    : total > 0 && isUrgent
      ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40"
      : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50";

  const dayBadge = total > 0 && status === "overdue"
    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
    : total > 0 && dueInfo?.urgency === "today"
      ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
    : total > 0 && isUrgent
      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
      : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400";

  const barColor = total > 0 && status === "overdue" ? "#ef4444"
    : total > 0 && dueInfo?.urgency === "today"   ? "#ef4444"
    : total > 0 && isUrgent                       ? "#f59e0b"
    : card.color;

  return (
    <div className={`rounded-xl shadow-sm overflow-hidden ${cardBg}`}>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
            onClick={() => onExpandCard(isOpen ? null : card.id)}
          >
            <div
              className="w-8 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${card.color}bb, ${card.color})` }}
            >
              <CreditCard size={11} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{card.name}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-400 dark:text-slate-500 capitalize">{card.owner}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${dayBadge}`}>
                  Dia {card.due_day}
                </span>
                {dueInfo && (
                  <span className={`text-xs font-medium ${
                    dueInfo.urgency === "overdue" || dueInfo.urgency === "today"
                      ? "text-red-500 dark:text-red-400"
                      : dueInfo.urgency === "later"
                      ? "text-slate-400 dark:text-slate-500"
                      : "text-amber-600 dark:text-amber-400"
                  }`}>
                    · {dueInfo.label}
                  </span>
                )}
                {txs.length > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {txs.length} lanç.{parcelCount > 0 && ` · ${parcelCount} parc.`}
                  </span>
                )}
              </div>
            </div>
            {txs.length > 0 && (
              isOpen
                ? <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
                : <ChevronRight size={14} className="text-slate-400 shrink-0 ml-1" />
            )}
          </button>

          <div className="flex items-center gap-2.5 shrink-0 ml-2">
            <div className="text-right">
              <p className={`text-sm font-bold ${total > 0 ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-600"}`}>
                {formatCurrency(total)}
              </p>
              {status === "paid" ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Pago</p>
              ) : status === "overdue" && total > 0 ? (
                <p className="text-xs text-red-500 dark:text-red-400 font-medium">
                  {dueInfo ? dueInfo.label : "Vencida!"}
                </p>
              ) : dueInfo ? (
                <p className={`text-xs font-medium ${
                  dueInfo.urgency === "today"
                    ? "text-red-500 dark:text-red-400"
                    : dueInfo.urgency === "later"
                    ? "text-slate-400 dark:text-slate-500"
                    : "text-amber-600 dark:text-amber-400"
                }`}>
                  {dueInfo.label}
                </p>
              ) : total > 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">Pendente</p>
              ) : null}
            </div>
            <Toggle checked={payment?.paid ?? false} onChange={v => onToggle(card, v)} disabled={total === 0} />
          </div>
        </div>

        {total > 0 && incomeTotal > 0 && (
          <div className="mt-2">
            <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-1 rounded-full transition-all"
                style={{ width: `${Math.min((total / incomeTotal) * 100, 100)}%`, backgroundColor: barColor }} />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {((total / incomeTotal) * 100).toFixed(1)}% da renda
            </p>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 space-y-1.5">
          {txs.length === 0 ? (
            <p className="text-xs text-slate-400 py-1 text-center">Nenhum lançamento neste mês</p>
          ) : txs.map(tx => (
            <div key={tx.id} className="flex items-center justify-between gap-2 py-0.5">
              <div className="min-w-0 flex-1">
                <span className="text-xs text-slate-600 dark:text-slate-300 truncate block">{tx.description}</span>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {tx.installment_total > 1 && (
                    <span className="text-xs text-violet-500 font-medium">{tx.installment_current}/{tx.installment_total}x</span>
                  )}
                  <CategoryBadge category={tx.category} categories={categories} size="sm" />
                </div>
              </div>
              <span className={`text-xs font-semibold shrink-0 ${tx.amount > 0 ? "text-emerald-500" : "text-slate-600 dark:text-slate-300"}`}>
                {tx.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
