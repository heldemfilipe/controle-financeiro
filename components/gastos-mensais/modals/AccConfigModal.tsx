"use client";

import { Modal } from "@/components/ui/Modal";
import { MONTHS } from "@/types";
import type { AccumuladoConfig } from "@/lib/utils";

interface AccConfigModalProps {
  open: boolean;
  onClose: () => void;
  value: AccumuladoConfig;
  onChange: (patch: Partial<AccumuladoConfig>) => void;
  onSave: () => void;
}

export function AccConfigModal({ open, onClose, value, onChange, onSave }: AccConfigModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Configurar Saldo Acumulado" size="sm">
      <div className="space-y-4">
        <div>
          <label className="label">Saldo inicial (R$)</label>
          <input
            className="input" type="number" step="0.01" autoFocus
            value={value.saldoInicial}
            onChange={e => onChange({ saldoInicial: Number(e.target.value) })}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Valor que você já tinha antes do período de acumulação (ex.: poupança, saldo em conta).
          </p>
        </div>
        <div>
          <label className="label">Início do acumulado</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="input"
              value={value.startMonth}
              onChange={e => onChange({ startMonth: Number(e.target.value) })}
            >
              {MONTHS.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
            <input
              className="input" type="number" min="2020" max="2099"
              value={value.startYear}
              onChange={e => onChange({ startYear: Number(e.target.value) })}
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Meses anteriores a esta data serão ignorados no cálculo acumulado.
          </p>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onSave} className="btn-primary flex-1">Salvar</button>
        </div>
      </div>
    </Modal>
  );
}
