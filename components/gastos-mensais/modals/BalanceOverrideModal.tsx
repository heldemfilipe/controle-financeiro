"use client";

import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { formatCurrency } from "@/lib/utils";

export interface OverrideForm {
  autoZero: boolean;
  amount: string;
  notes: string;
}

interface BalanceOverrideModalProps {
  open: boolean;
  onClose: () => void;
  form: OverrideForm;
  onFormChange: (patch: Partial<OverrideForm>) => void;
  hasExisting: boolean;
  calculatedBalance: number;
  onSave: () => void;
  onRemove: () => void;
}

export function BalanceOverrideModal({
  open, onClose, form, onFormChange, hasExisting, calculatedBalance, onSave, onRemove,
}: BalanceOverrideModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Ajustar Saldo do Mês" size="sm">
      <div className="space-y-4">
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/30 rounded-lg p-3">
          <p className="text-xs text-violet-700 dark:text-violet-300 font-medium mb-1">
            Quando usar este ajuste?
          </p>
          <p className="text-xs text-violet-600 dark:text-violet-400">
            Quando um emprestimo cobriu o deficit do mes ou quando o saldo real e diferente do calculado.
            O proximo mes usara o valor ajustado como saldo anterior.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Zerar saldo</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Emprestimo cobriu o deficit</p>
          </div>
          <Toggle
            checked={form.autoZero}
            onChange={v => onFormChange({ autoZero: v, amount: v ? "0" : form.amount })}
          />
        </div>

        {!form.autoZero && (
          <div>
            <label className="label">Saldo real deste mes (R$)</label>
            <input
              className="input" type="number" step="0.01"
              value={form.amount}
              onChange={e => onFormChange({ amount: e.target.value })}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Saldo calculado: {formatCurrency(calculatedBalance)}
            </p>
          </div>
        )}

        <div>
          <label className="label">Observacao (opcional)</label>
          <input
            className="input"
            placeholder="Ex: Emprestimo SIM cobriu deficit, Peguei emprestado..."
            value={form.notes}
            onChange={e => onFormChange({ notes: e.target.value })}
          />
        </div>

        <div className="flex gap-2 pt-2">
          {hasExisting && (
            <button onClick={onRemove} className="btn-danger flex-1">
              Remover ajuste
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onSave} className="btn-primary flex-1">Salvar</button>
        </div>
      </div>
    </Modal>
  );
}
