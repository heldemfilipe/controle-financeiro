"use client";

import { FileText, CreditCard, ChevronsRight, X } from "lucide-react";
import { BillRow } from "@/components/gastos-mensais/BillRow";
import { CardRow } from "@/components/gastos-mensais/CardRow";
import { formatCurrency } from "@/lib/utils";
import { MONTHS } from "@/types";
import type {
  FixedBill, CreditCard as CCType, MonthlyBillPayment, MonthlyCardPayment,
  CardTransaction, BillAdvance,
} from "@/types";

interface QuinzenaSectionProps {
  label: string;
  subtitle: string;
  bills: FixedBill[];
  cards: CCType[];
  totalQ: number;
  // dependências para os cálculos internos e para BillRow/CardRow
  fixedBills: FixedBill[];
  billPayments: MonthlyBillPayment[];
  billAmount: (bill: FixedBill) => number;
  billEffectiveAmount: (bill: FixedBill) => number;
  billSt: (bill: FixedBill) => "paid" | "overdue" | "pending";
  advancedBillIds: Set<string>;
  advancesForThisMonth: BillAdvance[];
  advancesMadeThisMonth: BillAdvance[];
  cardTotals: Record<string, number>;
  cardPayments: MonthlyCardPayment[];
  cardSt: (card: CCType) => "paid" | "overdue" | "pending";
  cardTransactions: CardTransaction[];
  expandedCard: string | null;
  onExpandCard: (cardId: string | null) => void;
  month: number;
  year: number;
  incomeTotal: number;
  onToggleBill: (bill: FixedBill, paid: boolean) => void;
  onToggleCard: (card: CCType, paid: boolean) => void;
  onAdvanceBill: (bill: FixedBill) => void;
  onEditBill: (bill: FixedBill) => void;
  onRemoveAdvance: (id: string) => void;
}

export function QuinzenaSection({
  label, subtitle, bills, cards, totalQ,
  fixedBills, billPayments, billAmount, billEffectiveAmount, billSt,
  advancedBillIds, advancesForThisMonth, advancesMadeThisMonth,
  cardTotals, cardPayments, cardSt, cardTransactions, expandedCard, onExpandCard,
  month, year, incomeTotal, onToggleBill, onToggleCard, onAdvanceBill, onEditBill, onRemoveAdvance,
}: QuinzenaSectionProps) {
  const isQ1     = label.startsWith("1");
  const accent   = isQ1 ? "primary" : "amber";
  const period   = isQ1 ? "1-15" : "16-30";
  const billsSum = bills.reduce((s, b) => s + billEffectiveAmount(b), 0);
  // Adiantamentos feitos neste mês para este período
  const periodAdvances = advancesMadeThisMonth.filter(
    adv => (fixedBills.find(b => b.id === adv.bill_id)?.period ?? "16-30") === period
  );
  const cardsSum = cards.reduce((s, c) => s + (cardTotals[c.id] ?? 0), 0);

  // Agrupamento dinâmico por categoria (suporta categorias customizadas)
  // Ordena os grupos pela menor due_day de qualquer conta naquele grupo
  const catGroups = Array.from(new Set(bills.map(b => b.category || "outros")))
    .sort((a, b) => {
      const minA = Math.min(...bills.filter(x => (x.category || "outros") === a).map(x => x.due_day ?? 99));
      const minB = Math.min(...bills.filter(x => (x.category || "outros") === b).map(x => x.due_day ?? 99));
      return minA - minB;
    });
  // Ordena cartões por due_day dentro da quinzena
  const sortedCards = [...cards].sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99));

  return (
    <div>
      {/* Cabeçalho da quinzena */}
      <div className={`flex items-center justify-between border-b-2 pb-2.5 mb-4
        border-${accent}-200 dark:border-${accent}-800/40`}>
        <div>
          <h2 className={`text-base font-bold text-${accent}-700 dark:text-${accent}-400`}>
            {label}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-lg
          bg-${accent}-50 dark:bg-${accent}-900/20
          text-${accent}-700 dark:text-${accent}-400`}>
          {formatCurrency(totalQ)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contas */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <FileText size={12} />
            Contas — {formatCurrency(billsSum)}
          </h3>

          {bills.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
              Nenhuma conta neste período
            </p>
          ) : (
            <div className="space-y-3">
              {catGroups.map(cat => {
                const catBills = bills
                  .filter(b => (b.category || "outros") === cat)
                  .sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99));
                if (catBills.length === 0) return null;
                const isEssencial = cat === "essencial";
                return (
                  <div key={cat}>
                    <p className={`text-xs font-medium mb-1.5 ${
                      isEssencial
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </p>
                    <div className="space-y-1.5">
                      {catBills.map(b => (
                        <BillRow
                          key={b.id}
                          bill={b}
                          advancesForThisMonth={advancesForThisMonth}
                          billPayments={billPayments}
                          billSt={billSt}
                          billAmount={billAmount}
                          month={month}
                          year={year}
                          onAdvance={onAdvanceBill}
                          onEdit={onEditBill}
                          onToggle={onToggleBill}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {(() => {
                const advancedInThis = bills.filter(b => advancedBillIds.has(b.id));
                const paidNormally   = bills.filter(b => !advancedBillIds.has(b.id) && billPayments.find(p => p.bill_id === b.id)?.paid);
                const paidSum        = paidNormally.reduce((s, b) => s + billAmount(b), 0);
                const advancedSum    = advancedInThis.reduce((s, b) => s + billAmount(b), 0);
                const remaining      = billsSum - paidSum;
                const totalPaid      = paidNormally.length + advancedInThis.length;
                return (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {totalPaid}/{bills.length} pagas
                      </span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {formatCurrency(billsSum)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ✓ Pago {formatCurrency(paidSum)}
                        {advancedSum > 0 && <span className="text-violet-500 ml-1">+ Adiantado {formatCurrency(advancedSum)}</span>}
                      </span>
                      <span className={remaining > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {remaining > 0 ? `Falta ${formatCurrency(remaining)}` : "Tudo pago ✓"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Adiantamentos feitos neste mês para meses futuros */}
              {periodAdvances.length > 0 && (
                <div className="pt-2 border-t border-violet-200 dark:border-violet-800/30">
                  <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                    <ChevronsRight size={12} />
                    Adiantamentos — {formatCurrency(periodAdvances.reduce((s, a) => s + a.amount, 0))}
                  </p>
                  <div className="space-y-1.5">
                    {periodAdvances.map(adv => {
                      const bill = fixedBills.find(b => b.id === adv.bill_id);
                      return (
                        <div key={adv.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/30">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-violet-700 dark:text-violet-300 truncate">
                              {bill?.name ?? "Conta"}
                            </p>
                            <p className="text-xs text-violet-500 dark:text-violet-400">
                              Para {MONTHS[adv.target_month - 1]}/{adv.target_year}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                              -{formatCurrency(adv.amount)}
                            </span>
                            <button
                              onClick={() => onRemoveAdvance(adv.id)}
                              title="Remover adiantamento"
                              className="p-0.5 hover:bg-violet-100 dark:hover:bg-violet-800/40 rounded transition-colors"
                            >
                              <X size={11} className="text-violet-400" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cartões */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <CreditCard size={12} />
            Cartões — {formatCurrency(cardsSum)}
          </h3>

          {cards.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
              Nenhum cartão neste período
            </p>
          ) : (
            <div className="space-y-2">
              {sortedCards.map(c => (
                <CardRow
                  key={c.id}
                  card={c}
                  cardTotals={cardTotals}
                  cardSt={cardSt}
                  cardPayments={cardPayments}
                  cardTransactions={cardTransactions}
                  expandedCard={expandedCard}
                  onExpandCard={onExpandCard}
                  month={month}
                  year={year}
                  incomeTotal={incomeTotal}
                  onToggle={onToggleCard}
                />
              ))}
              {(() => {
                const cardsWithValue = cards.filter(c => (cardTotals[c.id] ?? 0) > 0);
                const paidCards  = cardsWithValue.filter(c => cardPayments.find(p => p.card_id === c.id)?.paid);
                const paidSum    = paidCards.reduce((s, c) => s + (cardTotals[c.id] ?? 0), 0);
                const remaining  = cardsSum - paidSum;
                return (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {paidCards.length}/{cardsWithValue.length} pagas
                      </span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {formatCurrency(cardsSum)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ✓ Pago {formatCurrency(paidSum)}
                      </span>
                      <span className={remaining > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {remaining > 0 ? `Falta ${formatCurrency(remaining)}` : "Tudo pago ✓"}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
