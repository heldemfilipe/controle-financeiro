"use client";

import { Save, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { FixedBill } from "@/types";

interface BillModalProps {
  open: boolean;
  onClose: () => void;
  value: Partial<FixedBill>;
  onChange: (patch: Partial<FixedBill>) => void;
  onSave: () => void;
  saving: boolean;
  error: string;
}

export function BillModal({ open, onClose, value, onChange, onSave, saving, error }: BillModalProps) {
  return (
    <Modal open={open} onClose={onClose}
      title={value.id ? "Editar Conta Fixa" : "Nova Conta Fixa"} size="lg">
      <div className="space-y-3">
        <div>
          <label className="label">Nome da Conta</label>
          <input className="input" placeholder="Ex: Condomínio"
            value={value.name ?? ""}
            onChange={e => onChange({ name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Valor da Parcela (R$)</label>
            <input className="input" type="number" step="0.01"
              value={value.amount ?? ""}
              onChange={e => onChange({ amount: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Dia de Vencimento</label>
            <input className="input" type="number" min="1" max="31"
              value={value.due_day ?? ""}
              onChange={e => {
                const day = Number(e.target.value) || null;
                const autoPeriod = day ? (day <= 15 ? "1-15" : "16-30") : undefined;
                onChange({ due_day: day, ...(autoPeriod ? { period: autoPeriod as any } : {}) });
              }} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={value.category ?? "essencial"}
              onChange={e => onChange({ category: e.target.value as any })}>
              <option value="essencial">Essencial</option>
              <option value="outros">Outros</option>
            </select>
          </div>
          <div>
            <label className="label">Período do Mês</label>
            <select className="input" value={value.period ?? ""}
              onChange={e => onChange({ period: (e.target.value as any) || null })}>
              <option value="">Sem período</option>
              <option value="1-15">1 a 15</option>
              <option value="16-30">16 a 30</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Parcela Atual</label>
            <input className="input" type="number" placeholder="—"
              value={value.installment_current ?? ""}
              onChange={e => onChange({ installment_current: Number(e.target.value) || null })} />
          </div>
          <div>
            <label className="label">Total Parcelas</label>
            <input className="input" type="number" placeholder="—"
              value={value.installment_total ?? ""}
              onChange={e => onChange({ installment_total: Number(e.target.value) || null })} />
          </div>
          <div>
            <label className="label">Observações</label>
            <input className="input" placeholder="Notas"
              value={value.notes ?? ""}
              onChange={e => onChange({ notes: e.target.value })} />
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
