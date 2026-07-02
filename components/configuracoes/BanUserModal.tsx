"use client";

import { ShieldCheck, ShieldX } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { AppUser } from "@/types";

interface BanUserModalProps {
  user: AppUser | null;
  onClose: () => void;
  onConfirm: (user: AppUser) => void;
}

export function BanUserModal({ user, onClose, onConfirm }: BanUserModalProps) {
  return (
    <Modal open={!!user} onClose={onClose} title={user?.banned ? "Ativar Usuário" : "Desativar Usuário"} size="sm">
      <div className="text-center space-y-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
          user?.banned ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-red-50 dark:bg-red-900/20"
        }`}>
          {user?.banned
            ? <ShieldCheck size={22} className="text-emerald-500" />
            : <ShieldX size={22} className="text-red-500" />
          }
        </div>
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {user?.banned ? "Reativar acesso de" : "Bloquear acesso de"}
          </p>
          <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => user && onConfirm(user)}
            className={`flex-1 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 ${
              user?.banned
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}>
            {user?.banned ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
            {user?.banned ? "Ativar" : "Desativar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
