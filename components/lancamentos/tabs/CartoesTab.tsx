"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { CategoryBadge } from "@/components/lancamentos/CategoryBadge";
import { formatCurrency } from "@/lib/utils";
import type { CreditCard as CreditCardType, CardTransaction, Category } from "@/types";
import type { Owner } from "@/lib/owners";

interface CartoesTabProps {
  creditCards: CreditCardType[];
  cardTxs: CardTransaction[];
  categories: Category[];
  owners: Owner[];
  onAddCard: () => void;
  onAddGeneral: () => void;
  onQuickAdd: (cardId: string) => void;
  onEdit: (tx: CardTransaction) => void;
  onDelete: (tx: CardTransaction) => void;
}

export function CartoesTab({
  creditCards, cardTxs, categories, owners, onAddCard, onAddGeneral, onQuickAdd, onEdit, onDelete,
}: CartoesTabProps) {
  const [txSort, setTxSort] = useState<Record<string, "date" | "categoria" | "parcelas">>({});

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Lançamentos nos Cartões</h2>
        <div className="flex gap-2">
          <button
            onClick={onAddCard}
            className="btn-secondary flex items-center gap-1.5"
          >
            <Plus size={14} /> Novo Cartão
          </button>
          <button
            onClick={onAddGeneral}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus size={14} /> Lançar
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {creditCards.map((card) => {
          const sortMode = txSort[card.id] ?? "date";
          const rawTxs = cardTxs.filter(t => t.card_id === card.id);
          const txs = sortMode === "categoria"
            ? [...rawTxs].sort((a, b) => (a.category ?? "").localeCompare(b.category ?? ""))
            : sortMode === "parcelas"
              ? [...rawTxs].sort((a, b) =>
                  (a.installment_total - a.installment_current) - (b.installment_total - b.installment_current))
              : rawTxs;
          // Total líquido: despesas (negativas) − créditos (positivos)
          const total = rawTxs.reduce((s, t) => s - t.amount, 0);
          return (
            <div key={card.id} className="card transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: card.color }} />
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{card.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{card.bank} · Vence dia {card.due_day} · {owners.find(o => o.id === card.owner)?.name ?? card.owner}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {rawTxs.length > 0 && (
                    <div className="flex bg-slate-100 dark:bg-slate-700/60 rounded-lg p-0.5 text-xs">
                      <button
                        onClick={() => setTxSort(p => ({ ...p, [card.id]: "date" }))}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                          sortMode === "date"
                            ? "bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-100 shadow-sm"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >Data</button>
                      <button
                        onClick={() => setTxSort(p => ({ ...p, [card.id]: "categoria" }))}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                          sortMode === "categoria"
                            ? "bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-100 shadow-sm"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >Categoria</button>
                      <button
                        onClick={() => setTxSort(p => ({ ...p, [card.id]: "parcelas" }))}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                          sortMode === "parcelas"
                            ? "bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-100 shadow-sm"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >Parcelas</button>
                    </div>
                  )}
                  {/* Lançamento rápido: cartão já pré-selecionado */}
                  <button
                    onClick={() => onQuickAdd(card.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: `${card.color}22`, color: card.color }}
                    title={`Novo lançamento em ${card.name}`}
                  >
                    <Plus size={11} /> Lançar
                  </button>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(total)}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{rawTxs.length} lançamento{rawTxs.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>

              {txs.length > 0 ? (
                <div className="space-y-0">
                  {txs.map((tx) => (
                    <div key={tx.id}
                      className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                      <div>
                        <p className="text-sm text-slate-700 dark:text-slate-200">{tx.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {tx.installment_total > 1 && (
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              {tx.installment_current}/{tx.installment_total}x
                            </p>
                          )}
                          <CategoryBadge category={tx.category} categories={categories} size="sm" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${tx.amount > 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {tx.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
                        </span>
                        <button
                          onClick={() => onEdit(tx)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                        >
                          <Pencil size={12} className="text-slate-400 dark:text-slate-500" />
                        </button>
                        <button
                          onClick={() => onDelete(tx)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        >
                          <Trash2 size={12} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-2 text-center">
                  Nenhum lançamento neste mês
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
