"use client";

import { Save, AlertCircle, CreditCard } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { CreditCard as CreditCardType } from "@/types";
import type { Owner } from "@/lib/owners";

interface CardModalProps {
  open: boolean;
  onClose: () => void;
  value: Partial<CreditCardType>;
  onChange: (patch: Partial<CreditCardType>) => void;
  onSave: () => void;
  saving: boolean;
  error: string;
  owners: Owner[];
}

const COLOR_PRESETS = ["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#10b981", "#06b6d4"];

export function CardModal({ open, onClose, value, onChange, onSave, saving, error, owners }: CardModalProps) {
  return (
    <Modal open={open} onClose={onClose}
      title={value.id ? "Editar Cartão" : "Novo Cartão de Crédito"}>
      <div className="space-y-3">
        <div
          className="h-16 rounded-xl flex items-center justify-between px-4"
          style={{ background: `linear-gradient(135deg, ${(value.color ?? "#6366f1") + "cc"}, ${value.color ?? "#6366f1"})` }}
        >
          <div>
            <p className="text-white font-bold text-sm">{value.name || "Nome do Cartão"}</p>
            <p className="text-white/70 text-xs">{value.bank || "Banco"}</p>
          </div>
          <CreditCard size={20} className="text-white/70" />
        </div>

        <div>
          <label className="label">Nome do Cartão</label>
          <input className="input" placeholder="Ex: NUBANK P1"
            value={value.name ?? ""}
            onChange={e => onChange({ name: e.target.value.toUpperCase() })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Banco</label>
            <input className="input" placeholder="Ex: Nubank"
              value={value.bank ?? ""}
              onChange={e => onChange({ bank: e.target.value })} />
          </div>
          <div>
            <label className="label">Dia Vencimento</label>
            <input className="input" type="number" min="1" max="31"
              value={value.due_day ?? ""}
              onChange={e => onChange({ due_day: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Titular</label>
            <select className="input" value={value.owner ?? (owners[0]?.id ?? "heldem")}
              onChange={e => onChange({ owner: e.target.value as any })}>
              {owners.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cor do Cartão</label>
            <div className="flex items-center gap-2">
              <input className="h-9 w-12 rounded border border-slate-200 dark:border-slate-600 cursor-pointer" type="color"
                value={value.color ?? "#6366f1"}
                onChange={e => onChange({ color: e.target.value })} />
              <input className="input flex-1" placeholder="#6366f1"
                value={value.color ?? "#6366f1"}
                onChange={e => onChange({ color: e.target.value })} />
            </div>
            <div className="flex gap-1.5 mt-1.5">
              {COLOR_PRESETS.map(c => (
                <button key={c} onClick={() => onChange({ color: c })}
                  className="w-5 h-5 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: value.color === c ? "white" : "transparent",
                    boxShadow: value.color === c ? `0 0 0 2px ${c}` : "none",
                  }} />
              ))}
            </div>
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
