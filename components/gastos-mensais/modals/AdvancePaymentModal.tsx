"use client";

import { ChevronsRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { MONTHS } from "@/types";
import type { FixedBill } from "@/types";

export interface AdvanceTarget {
  bill: FixedBill;
  targetMonth: number;
  targetYear: number;
  amount: string;
  notes: string;
}

interface AdvancePaymentModalProps {
  target: AdvanceTarget | null;
  onClose: () => void;
  onChange: (patch: Partial<{ targetMonth: number; targetYear: number; amount: string; notes: string }>) => void;
  month: number;
  year: number;
  onSave: () => void;
}

export function AdvancePaymentModal({ target, onClose, onChange, month, year, onSave }: AdvancePaymentModalProps) {
  if (!target) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Adiantar — ${target.bill.name}`}
      size="sm"
    >
      <div className="space-y-4">
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/30 rounded-lg p-3">
          <p className="text-xs text-violet-700 dark:text-violet-300 font-medium mb-1 flex items-center gap-1.5">
            <ChevronsRight size={12} /> Como funciona o adiantamento?
          </p>
          <p className="text-xs text-violet-600 dark:text-violet-400">
            O valor será debitado do mês atual e a parcela do mês selecionado ficará marcada como pré-paga, sem impactar o saldo daquele mês.
          </p>
        </div>

        <div>
          <label className="label">Adiantar para qual mês?</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="input"
              value={target.targetMonth}
              onChange={e => onChange({ targetMonth: Number(e.target.value) })}
            >
              {MONTHS.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
            <input
              className="input" type="number" min="2024" max="2099"
              value={target.targetYear}
              onChange={e => onChange({ targetYear: Number(e.target.value) })}
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Mês atual: {MONTHS[month - 1]}/{year}
          </p>
        </div>

        <div>
          <label className="label">Valor (R$)</label>
          <input
            className="input" type="number" step="0.01" autoFocus
            value={target.amount}
            onChange={e => onChange({ amount: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Observação (opcional)</label>
          <input
            className="input"
            placeholder="Ex: Adiantei 2 meses, Pagamento extra..."
            value={target.notes}
            onChange={e => onChange({ notes: e.target.value })}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button onClick={onSave} className="btn-primary flex-1">
            Confirmar Adiantamento
          </button>
        </div>
      </div>
    </Modal>
  );
}
