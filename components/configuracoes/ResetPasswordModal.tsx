"use client";

import { RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { AppUser } from "@/types";

interface ResetPasswordModalProps {
  user: AppUser | null;
  onClose: () => void;
  onConfirm: (user: AppUser) => void;
}

export function ResetPasswordModal({ user, onClose, onConfirm }: ResetPasswordModalProps) {
  return (
    <Modal open={!!user} onClose={onClose} title="Redefinir Senha" size="sm">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto">
          <RotateCcw size={22} className="text-amber-500" />
        </div>
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-300">Enviar e-mail de redefinição de senha para</p>
          <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => user && onConfirm(user)}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
            <RotateCcw size={14} /> Enviar
          </button>
        </div>
      </div>
    </Modal>
  );
}
