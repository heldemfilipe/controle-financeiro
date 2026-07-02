"use client";

import { Eye, EyeOff, Lock, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export interface NewUserForm {
  email: string;
  password: string;
  display_name: string;
  role: "admin" | "user";
}

interface NewUserModalProps {
  open: boolean;
  onClose: () => void;
  value: NewUserForm;
  onChange: (patch: Partial<NewUserForm>) => void;
  onSave: () => void;
  saving: boolean;
  showPassword: boolean;
  onToggleShowPassword: () => void;
}

export function NewUserModal({ open, onClose, value, onChange, onSave, saving, showPassword, onToggleShowPassword }: NewUserModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Criar Novo Usuário">
      <div className="space-y-3">
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" placeholder="usuario@email.com"
            value={value.email}
            onChange={e => onChange({ email: e.target.value })} />
        </div>
        <div>
          <label className="label">Senha</label>
          <div className="relative">
            <input className="input pr-10" type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres"
              value={value.password}
              onChange={e => onChange({ password: e.target.value })} />
            <button type="button" tabIndex={-1}
              onClick={onToggleShowPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Nome (opcional)</label>
            <input className="input" placeholder="Ex: João"
              value={value.display_name}
              onChange={e => onChange({ display_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Permissão</label>
            <select className="input" value={value.role}
              onChange={e => onChange({ role: e.target.value as any })}>
              <option value="user">Usuário comum</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
          <Lock size={13} className="mt-0.5 shrink-0" />
          O usuário poderá alterar a própria senha após o primeiro acesso.
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onSave} disabled={saving || !value.email || !value.password}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Users size={14} /> Criar Usuário
          </button>
        </div>
      </div>
    </Modal>
  );
}
