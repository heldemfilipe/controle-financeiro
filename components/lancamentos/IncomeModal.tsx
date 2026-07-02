"use client";

import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { MONTHS } from "@/types";
import type { IncomeSource } from "@/types";
import type { Owner } from "@/lib/owners";

interface IncomeModalProps {
  open: boolean;
  onClose: () => void;
  value: Partial<IncomeSource>;
  onChange: (patch: Partial<IncomeSource>) => void;
  onSave: () => void;
  saving: boolean;
  owners: Owner[];
  month: number;
  year: number;
}

export function IncomeModal({ open, onClose, value, onChange, onSave, saving, owners, month, year }: IncomeModalProps) {
  return (
    <Modal open={open} onClose={onClose}
      title={value.id ? "Editar Fonte de Renda" : "Nova Fonte de Renda"}>
      <div className="space-y-3">
        <div>
          <label className="label">Nome</label>
          <input className="input" placeholder="Ex: Salário Heldem dia 15"
            value={value.name ?? ""}
            onChange={e => onChange({ name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Valor (R$)</label>
            <input className="input" type="number" step="0.01" placeholder="0,00"
              value={value.base_amount || ""}
              onChange={e => onChange({ base_amount: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Dia de Recebimento</label>
            <input className="input" type="number" min="1" max="31" placeholder="15"
              value={value.due_day ?? ""}
              onChange={e => onChange({ due_day: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
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

        {/* Receita avulsa (somente um mês) */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Somente este mês</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Receita avulsa, não recorrente</p>
          </div>
          <Toggle
            checked={value.is_recurring === false}
            onChange={v => onChange({
              is_recurring: !v,
              one_time_month: !v ? (value.one_time_month ?? month) : null,
              one_time_year:  !v ? (value.one_time_year  ?? year)  : null,
            })}
          />
        </div>

        {/* Mês/Ano da receita avulsa */}
        {value.is_recurring === false && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mês</label>
              <select className="input" value={value.one_time_month ?? month}
                onChange={e => onChange({ one_time_month: Number(e.target.value) })}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ano</label>
              <input className="input" type="number" min="2020" max="2035"
                value={value.one_time_year ?? year}
                onChange={e => onChange({ one_time_year: Number(e.target.value) })} />
            </div>
          </div>
        )}

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
