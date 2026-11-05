"use client";

import { AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { getCurrentMonth, getMonthName } from "@/lib/utils";

export type DeleteScope = "from_month" | "all";

export interface DeleteTarget {
  type: string;
  id: string;
  name: string;
  /** Receita avulsa existe em um único mês, então não há o que encerrar */
  oneTime?: boolean;
}

interface DeleteConfirmModalProps {
  target: DeleteTarget | null;
  onClose: () => void;
  onConfirm: (target: DeleteTarget, scope: DeleteScope) => void;
}

export function DeleteConfirmModal({ target, onClose, onConfirm }: DeleteConfirmModalProps) {
  const { month, year } = getCurrentMonth();

  return (
    <Modal open={!!target} onClose={onClose} title="Confirmar Exclusão" size="sm">
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={22} className="text-red-500" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">Como deseja remover</p>
          <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">&ldquo;{target?.name}&rdquo;?</p>
        </div>

        <div className="flex flex-col gap-2">
          {!target?.oneTime && (
            <button
              onClick={() => target && onConfirm(target, "from_month")}
              className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                A partir de {getMonthName(month)}/{year}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Os meses anteriores continuam no saldo</p>
            </button>
          )}
          <button
            onClick={() => target && onConfirm(target, "all")}
            className="w-full text-left px-4 py-3 rounded-xl border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <p className="text-sm font-medium text-red-600 dark:text-red-400">De todos os meses</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Para lançamento feito por engano; muda o saldo dos meses passados</p>
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
