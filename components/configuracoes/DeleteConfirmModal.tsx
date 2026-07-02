"use client";

import { AlertCircle, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export interface DeleteTarget {
  type: string;
  id: string;
  name: string;
}

interface DeleteConfirmModalProps {
  target: DeleteTarget | null;
  onClose: () => void;
  onConfirm: (target: DeleteTarget) => void;
}

export function DeleteConfirmModal({ target, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <Modal open={!!target} onClose={onClose}
      title="Confirmar Exclusão" size="sm">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle size={22} className="text-red-500" />
        </div>
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-300">Tem certeza que deseja remover</p>
          <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">"{target?.name}"?</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Esta ação irá desativar o item. O histórico de pagamentos será preservado.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={() => target && onConfirm(target)}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Trash2 size={14} /> Remover
          </button>
        </div>
      </div>
    </Modal>
  );
}
