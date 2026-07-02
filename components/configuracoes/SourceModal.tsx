"use client";

import { Save, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { IncomeSource } from "@/types";
import type { Owner } from "@/lib/owners";

interface SourceModalProps {
  open: boolean;
  onClose: () => void;
  value: Partial<IncomeSource>;
  onChange: (patch: Partial<IncomeSource>) => void;
  onSave: () => void;
  saving: boolean;
  error: string;
  owners: Owner[];
}

export function SourceModal({ open, onClose, value, onChange, onSave, saving, error, owners }: SourceModalProps) {
  return (
    <Modal open={open} onClose={onClose}
      title={value.id ? "Editar Fonte de Renda" : "Nova Fonte de Renda"}>
      <div className="space-y-3">
        <div>
          <label className="label">Nome</label>
          <input className="input" placeholder="Ex: Salário Pessoa 1"
            value={value.name ?? ""}
            onChange={e => onChange({ name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Valor Base (R$)</label>
            <input className="input" type="number" step="0.01"
              value={value.base_amount ?? ""}
              onChange={e => onChange({ base_amount: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Dia de Recebimento</label>
            <input className="input" type="number" min="1" max="31" placeholder="15"
              value={value.due_day ?? ""}
              onChange={e => onChange({ due_day: Number(e.target.value) || null })} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Responsável</label>
            <select className="input" value={value.owner ?? (owners[0]?.id ?? "casal")}
              onChange={e => onChange({ owner: e.target.value as any })}>
              {owners.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={value.type ?? "salary"}
              onChange={e => onChange({ type: e.target.value as any })}>
              <option value="salary">Salário</option>
              <option value="extra">Extra</option>
              <option value="other">Outro</option>
            </select>
          </div>
        </div>
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 text-xs text-red-600 dark:text-red-400">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
