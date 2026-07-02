"use client";

import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";
import type { FixedBill } from "@/types";

export interface EditBillAmountTarget {
  bill: FixedBill;
  amount: string;
  notes: string;
}

interface EditBillAmountModalProps {
  target: EditBillAmountTarget | null;
  onClose: () => void;
  onChange: (patch: Partial<{ amount: string; notes: string }>) => void;
  titheTotal: number;
  incomeTotal: number;
  onSave: () => void;
}

export function EditBillAmountModal({ target, onClose, onChange, titheTotal, incomeTotal, onSave }: EditBillAmountModalProps) {
  if (!target) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Editar valor — ${target.bill.name}`}
      size="sm"
    >
      <div className="space-y-3">
        <div>
          <label className="label">Valor (R$) neste mês</label>
          <input
            className="input" type="number" step="0.01" autoFocus
            value={target.amount}
            onChange={e => onChange({ amount: e.target.value })}
          />
          {target.bill.is_tithe && (
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
              Calculado automaticamente: {formatCurrency(titheTotal)} (10% de {formatCurrency(incomeTotal)})
            </p>
          )}
        </div>
        <div>
          <label className="label">Observação (opcional)</label>
          <input
            className="input"
            placeholder="Ex: Empréstimo incluído, Desconto recebido…"
            value={target.notes}
            onChange={e => onChange({ notes: e.target.value })}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button onClick={onSave} className="btn-primary flex-1">
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
