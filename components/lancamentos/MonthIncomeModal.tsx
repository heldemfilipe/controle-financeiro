"use client";

import { RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { MONTHS } from "@/types";
import { formatCurrency, resolveSourceAmount } from "@/lib/utils";
import type { IncomeSource, IncomeSourceAmount, MonthlyIncome } from "@/types";

interface MonthIncomeModalProps {
  open: boolean;
  onClose: () => void;
  source: IncomeSource | null;
  month: number;
  year: number;
  monthlyIncomes: MonthlyIncome[];
  sourceAmounts: IncomeSourceAmount[];
  skip: boolean;
  onSkipChange: (skip: boolean) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  amountError?: string;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}

export function MonthIncomeModal({
  open, onClose, source, month, year, monthlyIncomes, sourceAmounts,
  skip, onSkipChange, amount, onAmountChange, amountError, onSave, onReset, saving,
}: MonthIncomeModalProps) {
  return (
    <Modal open={open} onClose={onClose}
      title={`Ajustar em ${MONTHS[month - 1]} ${year}`}>
      {source && (() => {
        const mi = monthlyIncomes.find(m => m.source_id === source.id);
        const defaultAmt = resolveSourceAmount(source, month, year, sourceAmounts);
        const hasOverride = mi != null && mi.amount !== defaultAmt;
        return (
          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg px-3 py-2.5">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{source.name}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Altera o valor <b>somente em {MONTHS[month - 1]}/{year}</b>. Os demais meses mantêm o valor padrão de {formatCurrency(defaultAmt)}.
              </p>
            </div>

            {/* Sem recebimento neste mês */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Sem recebimento neste mês</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Zera esta renda só em {MONTHS[month - 1]}</p>
              </div>
              <Toggle
                checked={skip}
                onChange={v => onSkipChange(v)}
              />
            </div>

            {/* Valor customizado (oculto quando "sem recebimento") */}
            {!skip && (
              <div>
                <label className="label">Valor neste mês (R$)</label>
                <input className="input" type="number" step="0.01" placeholder="0,00"
                  value={amount}
                  onChange={e => onAmountChange(e.target.value)} />
                {amountError && (
                  <p className="text-xs text-red-500 mt-1">{amountError}</p>
                )}
              </div>
            )}

            {hasOverride && (
              <button onClick={onReset} disabled={saving}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 py-1.5">
                <RotateCcw size={13} /> Voltar ao valor padrão ({formatCurrency(defaultAmt)})
              </button>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={onClose}
                className="btn-secondary flex-1">Cancelar</button>
              <button onClick={onSave} disabled={saving}
                className="btn-primary flex-1">Salvar</button>
            </div>
          </div>
        );
      })()}
    </Modal>
  );
}
