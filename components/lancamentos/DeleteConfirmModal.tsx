"use client";

import { Modal } from "@/components/ui/Modal";
import { MONTHS } from "@/types";
import type { FixedBill, CardTransaction } from "@/types";

export type DeleteTarget =
  | { type: "income"; id: string; label: string; recurring: boolean }
  | { type: "bill";   bill: FixedBill }
  | { type: "tx";     tx: CardTransaction };

interface DeleteConfirmModalProps {
  target: DeleteTarget | null;
  onClose: () => void;
  onConfirm: (scope: "this" | "following" | "from_month" | "permanent") => void;
  saving: boolean;
  month: number;
  year: number;
}

export function DeleteConfirmModal({ target, onClose, onConfirm, saving, month, year }: DeleteConfirmModalProps) {
  const endOptions = (
    <>
      <button
        onClick={() => onConfirm("from_month")}
        disabled={saving}
        className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">A partir de {MONTHS[month - 1]}/{year}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Os meses anteriores continuam no saldo</p>
      </button>
      <button
        onClick={() => onConfirm("permanent")}
        disabled={saving}
        className="w-full text-left px-4 py-3 rounded-xl border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <p className="text-sm font-medium text-red-600 dark:text-red-400">De todos os meses</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Para lançamento feito por engano; muda o saldo dos meses passados</p>
      </button>
    </>
  );

  return (
    <Modal open={!!target} onClose={onClose} title="Remover lançamento" size="sm">
      {target && (
        <div className="space-y-4">
          {/* Descrição */}
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {target.type === "income" && (
              <>{target.recurring ? "Como deseja remover" : "Remover"} a receita <strong>&ldquo;{target.label}&rdquo;</strong>?</>
            )}
            {target.type === "bill" && (
              <><strong>&ldquo;{target.bill.name}&rdquo;</strong> é uma conta recorrente. Como deseja remover?</>
            )}
            {target.type === "tx" && target.tx.installment_total > 1 && (
              <>Parcela <strong>{target.tx.installment_current}/{target.tx.installment_total}</strong> de <strong>&ldquo;{target.tx.description}&rdquo;</strong>. O que deseja fazer?</>
            )}
            {target.type === "tx" && target.tx.installment_total <= 1 && (
              <>Remover o lançamento <strong>&ldquo;{target.tx.description}&rdquo;</strong>?</>
            )}
          </p>

          {/* Opções */}
          <div className="flex flex-col gap-2">
            {target.type === "bill" && (
              <>
                <button
                  onClick={() => onConfirm("this")}
                  disabled={saving}
                  className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Só este mês</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">A conta continua nos meses seguintes</p>
                </button>
                {endOptions}
              </>
            )}

            {target.type === "income" && target.recurring && endOptions}

            {target.type === "tx" && target.tx.installment_total > 1 && (
              <>
                <button
                  onClick={() => onConfirm("this")}
                  disabled={saving}
                  className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Só esta parcela</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">As parcelas seguintes continuam normalmente</p>
                </button>
                <button
                  onClick={() => onConfirm("following")}
                  disabled={saving}
                  className="w-full text-left px-4 py-3 rounded-xl border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Esta e as parcelas seguintes</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Remove da parcela {target.tx.installment_current} até a {target.tx.installment_total}</p>
                </button>
              </>
            )}

            {((target.type === "tx" && target.tx.installment_total <= 1) || (target.type === "income" && !target.recurring)) && (
              <button
                onClick={() => onConfirm("this")}
                disabled={saving}
                className="w-full text-left px-4 py-3 rounded-xl border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Confirmar remoção</p>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
