"use client";

import { Modal } from "@/components/ui/Modal";
import { MONTHS } from "@/types";
import { formatCurrency, installmentEndDate } from "@/lib/utils";
import type { FixedBill, Category } from "@/types";

interface BillModalProps {
  open: boolean;
  onClose: () => void;
  value: Partial<FixedBill>;
  onChange: (patch: Partial<FixedBill>) => void;
  onSave: () => void;
  saving: boolean;
  categories: Category[];
  month: number;
  year: number;
}

export function BillModal({ open, onClose, value, onChange, onSave, saving, categories, month, year }: BillModalProps) {
  return (
    <Modal open={open} onClose={onClose}
      title={value.id ? "Editar Conta" : "Nova Conta"}>
      <div className="space-y-3">
        {/* Badge de quinzena pré-selecionada */}
        {!value.id && value.period && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30">
            <div className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 shrink-0" />
            <span className="text-xs font-semibold text-primary-700 dark:text-primary-400">
              {value.period === "1-15" ? "1ª Quinzena" : "2ª Quinzena"}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">pré-selecionada</span>
          </div>
        )}
        <div>
          <label className="label">Nome da Conta</label>
          <input className="input" placeholder="Ex: Condomínio"
            value={value.name ?? ""}
            onChange={e => onChange({ name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Valor da Parcela (R$)</label>
            <input className="input" type="number" step="0.01" placeholder="0,00"
              value={value.amount || ""}
              onChange={e => onChange({ amount: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Dia de Vencimento</label>
            <input className="input" type="number" min="1" max="31" placeholder="10"
              value={value.due_day ?? ""}
              onChange={e => {
                const day = Number(e.target.value) || null;
                const autoPeriod = day ? (day <= 15 ? "1-15" : "16-30") : undefined;
                onChange({ due_day: day, ...(autoPeriod ? { period: autoPeriod as any } : {}) });
              }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Categoria customizável */}
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={value.category ?? "essencial"}
              onChange={e => onChange({ category: e.target.value })}>
              {categories.length === 0
                ? <><option value="essencial">Essencial</option><option value="outros">Outros</option></>
                : categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
              }
            </select>
          </div>
          <div>
            <label className="label">Período</label>
            <select className="input" value={value.period ?? ""}
              onChange={e => onChange({ period: (e.target.value as any) || null })}>
              <option value="">Sem período</option>
              <option value="1-15">1ª Quinzena</option>
              <option value="16-30">2ª Quinzena</option>
            </select>
          </div>
        </div>

        {/* Parcelas: total + parcela atual do mês selecionado */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Total de Parcelas</label>
            <input className="input" type="number" min="1" placeholder="Sem parcelas"
              value={value.installment_total ?? ""}
              onChange={e => onChange({ installment_total: Number(e.target.value) || null, installment_current: null })} />
          </div>
          <div>
            <label className="label">Parcela atual</label>
            <input className="input" type="number" min="1"
              max={value.installment_total ?? undefined}
              placeholder="Ex: 3"
              disabled={!value.installment_total}
              value={value.installment_current ?? ""}
              onChange={e => onChange({ installment_current: Number(e.target.value) || null })} />
          </div>
        </div>

        {/* Obs separado */}
        <div>
          <label className="label">Obs</label>
          <input className="input" placeholder="Notas"
            value={value.notes ?? ""}
            onChange={e => onChange({ notes: e.target.value })} />
        </div>

        {/* Preview auto-calculado das parcelas */}
        {(value.installment_total ?? 0) > 0 && (value.installment_current ?? 0) > 0 && (() => {
          const n   = value.installment_total!;
          const cur = value.installment_current!;
          const monthIdx = year * 12 + month - 1;
          const startIdx = monthIdx - (cur - 1);
          const sm  = (startIdx % 12) + 1;
          const sy  = Math.floor(startIdx / 12);
          const end = installmentEndDate(sm, sy, n);
          const remaining = n - cur + 1;
          return (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2 space-y-0.5">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Parcela {cur}/{n} · {formatCurrency(value.amount ?? 0)}/mês · falta {remaining}x
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Início: {MONTHS[sm - 1]}/{sy} · Término: {MONTHS[end.month - 1]}/{end.year}
              </p>
            </div>
          );
        })()}

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
