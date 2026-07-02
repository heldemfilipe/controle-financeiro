"use client";

import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { DescriptionAutocomplete, type TxSuggestion } from "@/components/ui/DescriptionAutocomplete";
import { MONTHS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import type { CardTransaction, CreditCard as CreditCardType, Category } from "@/types";

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  value: Partial<CardTransaction>;
  onChange: (patch: Partial<CardTransaction>) => void;
  onSave: () => void;
  saving: boolean;
  creditCards: CreditCardType[];
  categories: Category[];
  txSuggestions: TxSuggestion[];
  isCredit: boolean;
  onIsCreditChange: (v: boolean) => void;
  propagateCategory: boolean;
  onPropagateCategoryChange: (v: boolean) => void;
  month: number;
  year: number;
}

export function TransactionModal({
  open, onClose, value, onChange, onSave, saving, creditCards, categories, txSuggestions,
  isCredit, onIsCreditChange, propagateCategory, onPropagateCategoryChange, month, year,
}: TransactionModalProps) {
  return (
    <Modal open={open} onClose={onClose}
      title={value.id ? "Editar Lançamento" : "Novo Lançamento no Cartão"}>
      <div className="space-y-3">

        {/* Badge de cartão pré-selecionado (via lançamento rápido) */}
        {!value.id && value.card_id && (() => {
          const preCard = creditCards.find(c => c.id === value.card_id);
          if (!preCard) return null;
          return (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{ backgroundColor: `${preCard.color}18`, borderColor: `${preCard.color}40` }}
            >
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: preCard.color }} />
              <span className="text-xs font-semibold" style={{ color: preCard.color }}>
                {preCard.name}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">cartão pré-selecionado</span>
            </div>
          );
        })()}

        {/* Cartão — só mostra para novo lançamento */}
        {!value.id && (
          <div>
            <label className="label">Cartão</label>
            <select className="input" value={value.card_id ?? ""}
              onChange={e => onChange({ card_id: e.target.value })}>
              <option value="">Selecione...</option>
              {[...creditCards].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Descrição + Categoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Descrição</label>
            <DescriptionAutocomplete
              value={value.description ?? ""}
              onChange={v => onChange({ description: v })}
              onSelect={s => onChange({
                description: s.description,
                // Preenche categoria e valor típico automaticamente
                category: s.category ?? value.category,
                ...(s.amount > 0 && !value.amount ? { amount: s.amount } : {}),
              })}
              suggestions={txSuggestions}
              categories={categories}
            />
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={value.category ?? ""}
              onChange={e => onChange({ category: e.target.value || null })}>
              <option value="">Sem categoria</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Crédito / Estorno — apenas novo lançamento */}
        {!value.id && (
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Crédito / Estorno</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Ative se for reembolso ou saldo positivo no cartão</p>
            </div>
            <Toggle checked={isCredit} onChange={v => onIsCreditChange(v)} />
          </div>
        )}

        {/* Valor + Parcelas */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">
              {(value.installment_total ?? 1) > 1 ? "Valor da Parcela (R$)" : "Valor (R$)"}
            </label>
            <input className="input" type="number" step="0.01" placeholder="0,00"
              value={value.amount || ""}
              onChange={e => onChange({ amount: parseFloat(e.target.value) || 0 })} />
          </div>
          {/* Parcelas — só para novo */}
          {!value.id && (
            <div>
              <label className="label">Total de Parcelas</label>
              <input className="input" type="number" min="1" max="360" placeholder="1"
                value={value.installment_total ?? 1}
                onChange={e => onChange({ installment_total: Number(e.target.value) || 1 })} />
            </div>
          )}
        </div>

        {/* Parcela inicial — só quando parcelado e novo */}
        {!value.id && (value.installment_total ?? 1) > 1 && (
          <div>
            <label className="label">Parcela atual (qual é este mês?)</label>
            <input className="input" type="number" min="1" max={value.installment_total ?? 1}
              placeholder="1"
              value={value.installment_current ?? 1}
              onChange={e => onChange({ installment_current: Number(e.target.value) || 1 })} />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Preencha se a compra já começou em meses anteriores (ex: compra de 12x, hoje é a 3ª parcela)
            </p>
          </div>
        )}

        {/* Mês/Ano de início — sempre para novo lançamento */}
        {!value.id && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mês início</label>
              <select className="input" value={value.month ?? month}
                onChange={e => onChange({ month: Number(e.target.value) })}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ano início</label>
              <input className="input" type="number" min="2020" max="2035"
                value={value.year ?? year}
                onChange={e => onChange({ year: Number(e.target.value) })} />
            </div>
          </div>
        )}

        {/* Preview de parcelamento (novo lançamento com > 1 parcela) */}
        {!value.id && (value.installment_total ?? 1) > 1 && Number(value.amount) > 0 && (() => {
          const n         = value.installment_total!;
          const startInst = Math.max(1, Math.min(value.installment_current ?? 1, n));
          const startM    = value.month ?? month;
          const startY    = value.year  ?? year;
          const valor     = Number(value.amount);
          const remaining = n - startInst + 1;
          const totalIdx  = (startY * 12 + startM - 1) + (remaining - 1);
          const endMonth  = (totalIdx % 12) + 1;
          const endYear   = Math.floor(totalIdx / 12);
          return (
            <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 rounded-lg p-3 text-xs space-y-0.5">
              <p className="font-medium text-primary-700 dark:text-primary-400">
                {formatCurrency(valor)}/parcela × {remaining} {remaining !== n ? `meses restantes (de ${n}x)` : "meses"}
                {" "}= <span className="font-bold">{formatCurrency(valor * remaining)}</span>
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                De {MONTHS[startM - 1]}/{startY} ({startInst}/{n}) até {MONTHS[endMonth - 1]}/{endYear} ({n}/{n})
              </p>
            </div>
          );
        })()}

        {/* Info de parcela no modo edição */}
        {value.id && (value.installment_total ?? 1) > 1 && (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2 space-y-0.5">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Parcela {value.installment_current}/{value.installment_total}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              O valor será aplicado nesta e em todas as parcelas seguintes.
              A categoria só propaga se o toggle abaixo estiver ativo.
            </p>
          </div>
        )}

        {/* Propagar categoria — modo edição, parcelado */}
        {value.id && (value.installment_total ?? 1) > 1 && (
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Aplicar aos meses seguintes</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Propaga a categoria para todas as parcelas seguintes</p>
            </div>
            <Toggle checked={propagateCategory} onChange={v => onPropagateCategoryChange(v)} />
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
