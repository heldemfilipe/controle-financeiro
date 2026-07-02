"use client";

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
  owners: Owner[];
}

export function CardModal({ open, onClose, value, onChange, onSave, saving, owners }: CardModalProps) {
  return (
    <Modal open={open} onClose={onClose}
      title={value.id ? "Editar Cartão" : "Novo Cartão de Crédito"}>
      <div className="space-y-3">
        <div>
          <label className="label">Nome do Cartão</label>
          <input className="input" placeholder="Ex: NUBANK HELDEM"
            value={value.name ?? ""}
            onChange={e => onChange({ name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
        <div className="grid grid-cols-2 gap-3">
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
            <label className="label">Cor</label>
            <input className="input" type="color"
              value={value.color ?? "#6366f1"}
              onChange={e => onChange({ color: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose}
            className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onSave} disabled={saving}
            className="btn-primary flex-1">Salvar</button>
        </div>
      </div>
    </Modal>
  );
}
