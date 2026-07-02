"use client";

import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, getMonthName } from "@/lib/utils";
import type { IncomeSource, IncomeSourceAmount } from "@/types";

export interface NewAmountForm {
  month: number;
  year: number;
  amount: string;
  notes: string;
}

interface HistoryModalProps {
  source: IncomeSource | null;
  onClose: () => void;
  amounts: IncomeSourceAmount[];
  loading: boolean;
  newAmount: NewAmountForm;
  onNewAmountChange: (patch: Partial<NewAmountForm>) => void;
  onSaveEntry: () => void;
  saving: boolean;
  onRemoveEntry: (id: string) => void;
}

export function HistoryModal({
  source, onClose, amounts, loading, newAmount, onNewAmountChange, onSaveEntry, saving, onRemoveEntry,
}: HistoryModalProps) {
  return (
    <Modal open={!!source} onClose={onClose}
      title={`Histórico — ${source?.name ?? ""}`} size="lg">
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Registre mudanças de valor (aumento ou redução) com a data de início. O sistema usará
          o valor mais recente cadastrado para cada mês.
          Valor base: <span className="font-semibold text-slate-700 dark:text-slate-200">{source ? formatCurrency(source.base_amount) : ""}</span>
        </p>

        {/* Lista de entradas existentes */}
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : amounts.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">
            Nenhuma alteração registrada. O valor base é sempre usado.
          </p>
        ) : (
          <div className="space-y-1.5">
            {amounts.map(a => (
              <div key={a.id}
                className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/40 rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {formatCurrency(a.amount)}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                    a partir de {getMonthName(a.effective_month)}/{a.effective_year}
                  </span>
                  {a.notes && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">· {a.notes}</span>
                  )}
                </div>
                <button onClick={() => onRemoveEntry(a.id)}
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                  <Trash2 size={13} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Formulário para adicionar nova entrada */}
        <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3">
            Adicionar Alteração
          </p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label className="label">Mês</label>
              <select className="input" value={newAmount.month}
                onChange={e => onNewAmountChange({ month: Number(e.target.value) })}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Ano</label>
              <input className="input" type="number" min="2020" max="2099"
                value={newAmount.year}
                onChange={e => onNewAmountChange({ year: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Novo Valor (R$)</label>
              <input className="input" type="number" step="0.01" placeholder="0,00"
                value={newAmount.amount}
                onChange={e => onNewAmountChange({ amount: e.target.value })} />
            </div>
          </div>
          <div className="mb-3">
            <label className="label">Observação (opcional)</label>
            <input className="input" placeholder="Ex: Reajuste anual, promoção..."
              value={newAmount.notes}
              onChange={e => onNewAmountChange({ notes: e.target.value })} />
          </div>
          <button onClick={onSaveEntry} disabled={saving || !newAmount.amount}
            className="btn-primary w-full flex items-center justify-center gap-2">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Plus size={14} />}
            Registrar Alteração
          </button>
        </div>
      </div>
    </Modal>
  );
}
