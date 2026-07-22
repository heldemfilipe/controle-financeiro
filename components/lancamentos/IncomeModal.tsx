"use client";

import { Modal } from "@/components/ui/Modal";
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

type Recurrence = "always" | "from" | "once";

function recurrenceOf(v: Partial<IncomeSource>): Recurrence {
  if (v.is_recurring === false) return "once";
  if (v.start_month != null && v.start_year != null) return "from";
  return "always";
}

export function IncomeModal({ open, onClose, value, onChange, onSave, saving, owners, month, year }: IncomeModalProps) {
  const recurrence = recurrenceOf(value);

  function applyRecurrence(mode: Recurrence) {
    if (mode === "always") {
      onChange({
        is_recurring: true,
        start_month: null, start_year: null,
        one_time_month: null, one_time_year: null,
      });
    } else if (mode === "from") {
      onChange({
        is_recurring: true,
        start_month: value.start_month ?? month,
        start_year:  value.start_year  ?? year,
        one_time_month: null, one_time_year: null,
      });
    } else {
      onChange({
        is_recurring: false,
        one_time_month: value.one_time_month ?? month,
        one_time_year:  value.one_time_year  ?? year,
        start_month: null, start_year: null,
      });
    }
  }

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

        {/* Recorrência */}
        <div>
          <label className="label">Quando recebe</label>
          <select className="input" value={recurrence}
            onChange={e => applyRecurrence(e.target.value as Recurrence)}>
            <option value="always">Recorrente — todo mês</option>
            <option value="from">Recorrente — a partir de um mês</option>
            <option value="once">Somente um mês (avulso)</option>
          </select>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {recurrence === "always" && "Aparece em todos os meses."}
            {recurrence === "from" && "Passa a aparecer a partir do mês escolhido e continua nos meses seguintes. Ex: novo salário ou benefício a partir de agosto."}
            {recurrence === "once" && "Aparece só no mês escolhido, uma única vez."}
          </p>
        </div>

        {/* Mês/Ano de início (recorrente a partir de / avulso) */}
        {recurrence !== "always" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{recurrence === "from" ? "A partir de" : "Mês"}</label>
              <select className="input"
                value={(recurrence === "from" ? value.start_month : value.one_time_month) ?? month}
                onChange={e => onChange(
                  recurrence === "from"
                    ? { start_month: Number(e.target.value) }
                    : { one_time_month: Number(e.target.value) }
                )}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ano</label>
              <input className="input" type="number" min="2020" max="2035"
                value={(recurrence === "from" ? value.start_year : value.one_time_year) ?? year}
                onChange={e => onChange(
                  recurrence === "from"
                    ? { start_year: Number(e.target.value) }
                    : { one_time_year: Number(e.target.value) }
                )} />
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
