"use client";

import { Plus, CreditCard, Pencil } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import type { CreditCard as CreditCardType } from "@/types";
import type { Owner } from "@/lib/owners";

interface CartoesTabProps {
  cards: CreditCardType[];
  owners: Owner[];
  onAdd: () => void;
  onEdit: (card: CreditCardType) => void;
  onToggleActive: (card: CreditCardType) => void;
}

export function CartoesTab({ cards, owners, onAdd, onEdit, onToggleActive }: CartoesTabProps) {
  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Cartões de crédito cadastrados. O dia de vencimento é usado para alertas de pagamento.
        </p>
        <button onClick={onAdd}
          className="btn-primary flex items-center gap-1.5 shrink-0">
          <Plus size={14} /> Novo Cartão
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {cards.map((card) => (
          <div key={card.id}
            className={`bg-white dark:bg-slate-800 border rounded-xl p-4 transition-all ${
              card.active
                ? "border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600"
                : "border-slate-100 dark:border-slate-700/50 opacity-60"
            }`}>
            <div
              className="h-14 rounded-lg mb-3 flex items-center justify-between px-3"
              style={{ background: `linear-gradient(135deg, ${card.color}cc, ${card.color})` }}
            >
              <div>
                <p className="text-white font-bold text-sm">{card.name}</p>
                <p className="text-white/70 text-xs">{card.bank}</p>
              </div>
              <CreditCard size={20} className="text-white/70" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const o = owners.find(ow => ow.id === card.owner);
                    const color = o?.color ?? "#94a3b8";
                    const ownerLabel = o?.name ?? card.owner;
                    return (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${color}18`, color }}>
                        {ownerLabel}
                      </span>
                    );
                  })()}
                  <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full font-medium">
                    Vence dia {card.due_day}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Ativo</span>
                  <Toggle size="sm" checked={card.active} onChange={() => onToggleActive(card)} />
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onEdit(card)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <Pencil size={14} className="text-slate-400 dark:text-slate-500" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {cards.length === 0 && (
          <div className="col-span-2 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-8 text-center transition-colors">
            <CreditCard size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">Nenhum cartão cadastrado</p>
            <button onClick={onAdd}
              className="btn-primary">Adicionar Cartão</button>
          </div>
        )}
      </div>
    </div>
  );
}
