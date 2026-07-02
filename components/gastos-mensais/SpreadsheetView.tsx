"use client";

import { CreditCard, Sliders } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { formatCurrency, isOverdue, computeInstallment, resolveSourceAmount } from "@/lib/utils";
import type {
  FixedBill, CreditCard as CCType, MonthlyBillPayment, MonthlyCardPayment,
  IncomeSource, IncomeSourceAmount, MonthlyIncome, MonthlyBalanceOverride,
} from "@/types";

interface SpreadsheetViewProps {
  prevBalance: number;
  balance: number;
  balanceOverride: MonthlyBalanceOverride | null;
  q1Income: number;
  q1Total: number;
  q2Income: number;
  q2Total: number;
  q1Bills: FixedBill[];
  q1Cards: CCType[];
  q2Bills: FixedBill[];
  q2Cards: CCType[];
  month: number;
  year: number;
  billAmount: (bill: FixedBill) => number;
  billPayments: MonthlyBillPayment[];
  cardTotals: Record<string, number>;
  cardPayments: MonthlyCardPayment[];
  incomeSources: IncomeSource[];
  monthlyIncomes: MonthlyIncome[];
  sourceAmounts: IncomeSourceAmount[];
  incomeTotal: number;
  titheBill: FixedBill | undefined;
  tithePayment: MonthlyBillPayment | undefined;
  titheDisplayAmt: number;
  onToggleBill: (bill: FixedBill, paid: boolean) => void;
  onToggleCard: (card: CCType, paid: boolean) => void;
  onAdjustBalance: () => void;
}

export function SpreadsheetView({
  prevBalance, balance, balanceOverride, q1Income, q1Total, q2Income, q2Total,
  q1Bills, q1Cards, q2Bills, q2Cards, month, year, billAmount, billPayments,
  cardTotals, cardPayments, incomeSources, monthlyIncomes, sourceAmounts, incomeTotal,
  titheBill, tithePayment, titheDisplayAmt, onToggleBill, onToggleCard, onAdjustBalance,
}: SpreadsheetViewProps) {
  const accBalance = prevBalance + balance;
  const overrideValue = balanceOverride
    ? (balanceOverride.auto_zero ? 0 : balanceOverride.override_amount)
    : null;
  const displayBalance = overrideValue !== null ? overrideValue : accBalance;
  const saldoMeio = prevBalance + q1Income - q1Total;

  const allItems: { name: string; amount: number; dueDay: number | null; paid: boolean; type: "bill" | "card"; installment?: string; id: string; period: string }[] = [];

  // Bills 1-15
  q1Bills.forEach(b => {
    const inst = computeInstallment(b, month, year);
    allItems.push({
      name: b.name, amount: billAmount(b), dueDay: b.due_day,
      paid: billPayments.find(p => p.bill_id === b.id)?.paid ?? false,
      type: "bill", installment: inst ? `${inst.current}/${inst.total}x` : undefined,
      id: b.id, period: "1-15",
    });
  });
  // Cards 1-15
  q1Cards.forEach(c => {
    const total = cardTotals[c.id] ?? 0;
    if (total > 0) {
      allItems.push({
        name: c.name, amount: total, dueDay: c.due_day,
        paid: cardPayments.find(p => p.card_id === c.id)?.paid ?? false,
        type: "card", id: c.id, period: "1-15",
      });
    }
  });
  // Bills 16-30
  q2Bills.forEach(b => {
    const inst = computeInstallment(b, month, year);
    allItems.push({
      name: b.name, amount: billAmount(b), dueDay: b.due_day,
      paid: billPayments.find(p => p.bill_id === b.id)?.paid ?? false,
      type: "bill", installment: inst ? `${inst.current}/${inst.total}x` : undefined,
      id: b.id, period: "16-30",
    });
  });
  // Cards 16-30
  q2Cards.forEach(c => {
    const total = cardTotals[c.id] ?? 0;
    if (total > 0) {
      allItems.push({
        name: c.name, amount: total, dueDay: c.due_day,
        paid: cardPayments.find(p => p.card_id === c.id)?.paid ?? false,
        type: "card", id: c.id, period: "16-30",
      });
    }
  });

  const q1Items = allItems.filter(i => i.period === "1-15");
  const q2Items = allItems.filter(i => i.period === "16-30");

  function SheetRow({ item, onToggle }: { item: typeof allItems[0]; onToggle: (paid: boolean) => void }) {
    const status = item.paid ? "paid" : item.dueDay && isOverdue(item.dueDay, month, year) ? "overdue" : "pending";
    return (
      <div className={`flex items-center gap-2 py-2 px-3 border-b border-slate-100 dark:border-slate-700/30 ${
        status === "overdue" ? "bg-red-50/50 dark:bg-red-900/10" :
        status === "paid" ? "bg-emerald-50/30 dark:bg-emerald-900/5" : ""
      }`}>
        <Toggle checked={item.paid} onChange={onToggle} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {item.type === "card" && <CreditCard size={11} className="text-slate-400 shrink-0" />}
            <span className={`text-sm truncate ${item.paid ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>
              {item.name}
            </span>
            {item.installment && (
              <span className="text-xs text-violet-500 font-medium shrink-0">{item.installment}</span>
            )}
          </div>
        </div>
        {item.dueDay && (
          <span className={`text-xs shrink-0 ${status === "overdue" ? "text-red-500 font-medium" : "text-slate-400"}`}>
            dia {item.dueDay}
          </span>
        )}
        <span className={`text-sm font-semibold shrink-0 tabular-nums ${item.paid ? "text-slate-400" : "text-red-600 dark:text-red-400"}`}>
          -{formatCurrency(item.amount)}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl overflow-hidden mb-6">
      {/* Renda */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 border-b border-emerald-200 dark:border-emerald-800/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Receitas</span>
          <span className="text-sm font-bold text-emerald-600">{formatCurrency(incomeTotal)}</span>
        </div>
        {incomeSources.map(src => {
          const mi = monthlyIncomes.find(i => i.source_id === src.id);
          const amt = mi?.amount ?? resolveSourceAmount(src, month, year, sourceAmounts);
          return (
            <div key={src.id} className="flex items-center justify-between py-1">
              <span className="text-xs text-emerald-600 dark:text-emerald-400">{src.name}</span>
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 tabular-nums">+{formatCurrency(amt)}</span>
            </div>
          );
        })}
      </div>

      {/* Saldo anterior */}
      {prevBalance !== 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700/30">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Saldo mes anterior</span>
          <span className={`text-sm font-semibold tabular-nums ${prevBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {formatCurrency(prevBalance)}
          </span>
        </div>
      )}

      {/* Saldo dia 1 (receita 1ª quinzena + saldo anterior) */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800/30">
        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Saldo dia 1 (disponível)</span>
        <span className="text-sm font-bold text-blue-600 tabular-nums">{formatCurrency(prevBalance + q1Income)}</span>
      </div>

      {/* Contas 1-15 */}
      <div className="border-b-2 border-primary-200 dark:border-primary-800/40">
        <div className="flex items-center justify-between px-3 py-2 bg-primary-50 dark:bg-primary-900/20">
          <span className="text-xs font-bold text-primary-700 dark:text-primary-400 uppercase">Contas 1ª Quinzena (1-15)</span>
          <span className="text-sm font-bold text-primary-600">{formatCurrency(q1Total)}</span>
        </div>
        {q1Items.map(item => (
          <SheetRow key={item.id} item={item} onToggle={paid => {
            if (item.type === "bill") {
              const bill = q1Bills.find(b => b.id === item.id);
              if (bill) onToggleBill(bill, paid);
            } else {
              const card = q1Cards.find(c => c.id === item.id);
              if (card) onToggleCard(card, paid);
            }
          }} />
        ))}
        {titheBill && titheBill.period === "1-15" && (
          <div className="flex items-center gap-2 py-2 px-3 border-b border-slate-100 dark:border-slate-700/30 bg-violet-50/50 dark:bg-violet-900/10">
            <Toggle checked={tithePayment?.paid ?? false} onChange={v => onToggleBill(titheBill, v)} />
            <span className="text-sm text-violet-700 dark:text-violet-300 flex-1">Dizimo (10%)</span>
            <span className="text-sm font-semibold text-violet-600 tabular-nums">-{formatCurrency(titheDisplayAmt)}</span>
          </div>
        )}
      </div>

      {/* Saldo dia 15 */}
      <div className={`flex items-center justify-between px-3 py-2.5 ${
        saldoMeio >= 0
          ? "bg-emerald-50/70 dark:bg-emerald-900/15 border-b border-emerald-200 dark:border-emerald-800/30"
          : "bg-red-50/70 dark:bg-red-900/15 border-b border-red-200 dark:border-red-800/30"
      }`}>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Saldo dia 15</span>
        <span className={`text-sm font-bold tabular-nums ${saldoMeio >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {formatCurrency(saldoMeio)}
        </span>
      </div>

      {/* Receitas 2ª quinzena (entre saldo dia 15 e contas 16-30) */}
      {q2Income > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800/30">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Receitas 2ª Quinzena</span>
          <span className="text-sm font-bold text-emerald-600 tabular-nums">+{formatCurrency(q2Income)}</span>
        </div>
      )}

      {/* Contas 16-30 */}
      <div className="border-b-2 border-amber-200 dark:border-amber-800/40">
        <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-900/20">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">Contas 2ª Quinzena (16-30)</span>
          <span className="text-sm font-bold text-amber-600">{formatCurrency(q2Total)}</span>
        </div>
        {q2Items.map(item => (
          <SheetRow key={item.id} item={item} onToggle={paid => {
            if (item.type === "bill") {
              const bill = q2Bills.find(b => b.id === item.id);
              if (bill) onToggleBill(bill, paid);
            } else {
              const card = q2Cards.find(c => c.id === item.id);
              if (card) onToggleCard(card, paid);
            }
          }} />
        ))}
        {titheBill && titheBill.period === "16-30" && (
          <div className="flex items-center gap-2 py-2 px-3 border-b border-slate-100 dark:border-slate-700/30 bg-violet-50/50 dark:bg-violet-900/10">
            <Toggle checked={tithePayment?.paid ?? false} onChange={v => onToggleBill(titheBill, v)} />
            <span className="text-sm text-violet-700 dark:text-violet-300 flex-1">Dizimo (10%)</span>
            <span className="text-sm font-semibold text-violet-600 tabular-nums">-{formatCurrency(titheDisplayAmt)}</span>
          </div>
        )}
      </div>

      {/* Saldo final */}
      <div className={`flex items-center justify-between px-3 py-3 ${
        displayBalance >= 0
          ? "bg-emerald-50 dark:bg-emerald-900/20"
          : "bg-red-50 dark:bg-red-900/20"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Saldo Final</span>
            {balanceOverride && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 font-medium">
                {balanceOverride.auto_zero ? "Zerado" : "Ajustado"}
              </span>
            )}
          </div>
          {balanceOverride && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Calculado: {accBalance >= 0 ? "+" : ""}{formatCurrency(accBalance)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold tabular-nums ${displayBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {formatCurrency(displayBalance)}
          </span>
          <button onClick={onAdjustBalance} title="Ajustar saldo" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors">
            <Sliders size={12} className="text-violet-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
