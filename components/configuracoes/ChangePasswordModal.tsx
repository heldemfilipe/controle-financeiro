"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { AppUser } from "@/types";

interface ChangePasswordModalProps {
  user: AppUser | null;
  onClose: () => void;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  showPassword: boolean;
  onToggleShowPassword: () => void;
}

export function ChangePasswordModal({
  user, onClose, newPassword, onNewPasswordChange, onSave, saving, showPassword, onToggleShowPassword,
}: ChangePasswordModalProps) {
  return (
    <Modal open={!!user} onClose={onClose} title="Definir Nova Senha" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Usuário: <span className="font-medium text-slate-700 dark:text-slate-300">{user?.email}</span>
        </p>
        <div>
          <label className="label">Nova Senha</label>
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={e => onNewPasswordChange(e.target.value)}
              autoFocus
            />
            <button type="button" tabIndex={-1}
              onClick={onToggleShowPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onSave} disabled={saving || newPassword.length < 6}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Lock size={14} /> Salvar Senha
          </button>
        </div>
      </div>
    </Modal>
  );
}
