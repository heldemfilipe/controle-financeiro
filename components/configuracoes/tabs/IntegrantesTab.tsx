"use client";

import { User, Pencil, Trash2, Check, Plus, AlertCircle, RotateCcw } from "lucide-react";
import type { Owner } from "@/lib/owners";

interface IntegrantesTabProps {
  owners: Owner[];
  newOwner: { name: string; color: string };
  onNewOwnerChange: (patch: Partial<{ name: string; color: string }>) => void;
  editingOwner: Owner | null;
  onEditingOwnerChange: (owner: Owner) => void;
  onStartEdit: (owner: Owner) => void;
  onCancelEdit: () => void;
  ownerError: string;
  onAdd: () => void;
  onUpdate: () => void;
  onRemove: (id: string) => void;
  onReset: () => void;
}

export function IntegrantesTab({
  owners, newOwner, onNewOwnerChange, editingOwner, onEditingOwnerChange,
  onStartEdit, onCancelEdit, ownerError, onAdd, onUpdate, onRemove, onReset,
}: IntegrantesTabProps) {
  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Cadastre os integrantes da família. Eles serão usados como "titular" nos cartões e receitas.
          Os dados ficam salvos localmente neste dispositivo.
        </p>
      </div>

      {/* Lista de integrantes */}
      <div className="space-y-2 mb-5">
        {owners.map((owner) => (
          <div key={owner.id}
            className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3 flex items-center justify-between hover:border-slate-200 dark:hover:border-slate-600 transition-colors">
            {editingOwner?.id === owner.id ? (
              /* Edit inline */
              <div className="flex items-center gap-2 flex-1 mr-2">
                <input
                  type="color"
                  value={editingOwner.color}
                  onChange={e => onEditingOwnerChange({ ...editingOwner, color: e.target.value })}
                  className="h-8 w-8 rounded border border-slate-200 dark:border-slate-600 cursor-pointer shrink-0"
                />
                <input
                  className="input flex-1 py-1.5 text-sm"
                  value={editingOwner.name}
                  onChange={e => onEditingOwnerChange({ ...editingOwner, name: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && onUpdate()}
                  autoFocus
                />
                <button onClick={onUpdate}
                  className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 transition-colors shrink-0">
                  <Check size={14} />
                </button>
                <button onClick={onCancelEdit}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${owner.color}22` }}>
                    <User size={15} style={{ color: owner.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{owner.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{owner.id}</p>
                  </div>
                  <span className="w-3 h-3 rounded-full shrink-0 border border-white/40 shadow-sm"
                    style={{ backgroundColor: owner.color }} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onStartEdit(owner)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <Pencil size={13} className="text-slate-400 dark:text-slate-500" />
                  </button>
                  {owner.id !== "casal" && owners.length > 1 && (
                    <button onClick={() => onRemove(owner.id)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Adicionar novo */}
      <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">Novo Integrante</p>
        <div className="flex items-end gap-2">
          <div className="shrink-0">
            <label className="label">Cor</label>
            <input type="color" value={newOwner.color}
              onChange={e => onNewOwnerChange({ color: e.target.value })}
              className="h-9 w-10 rounded border border-slate-200 dark:border-slate-600 cursor-pointer" />
          </div>
          <div className="flex-1">
            <label className="label">Nome</label>
            <input className="input" placeholder="Ex: Maria, Pedro, Família..."
              value={newOwner.name}
              onChange={e => onNewOwnerChange({ name: e.target.value })}
              onKeyDown={e => e.key === "Enter" && onAdd()} />
          </div>
          <button onClick={onAdd}
            className="btn-primary shrink-0 flex items-center gap-1.5">
            <Plus size={14} /> Adicionar
          </button>
        </div>
        {ownerError && (
          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
            <AlertCircle size={12} /> {ownerError}
          </p>
        )}
      </div>

      {/* Reset */}
      <div className="mt-4 flex justify-end">
        <button onClick={onReset}
          className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 transition-colors">
          <RotateCcw size={12} /> Restaurar padrões (Heldem, Vitoria, Família)
        </button>
      </div>
    </div>
  );
}
