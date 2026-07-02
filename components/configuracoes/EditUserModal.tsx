"use client";

import { Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { AppUser } from "@/types";

export interface EditUserForm {
  display_name: string;
  role: "admin" | "user";
}

interface EditUserModalProps {
  open: boolean;
  onClose: () => void;
  editingUser: AppUser | null;
  value: EditUserForm;
  onChange: (patch: Partial<EditUserForm>) => void;
  onSave: () => void;
  saving: boolean;
}

export function EditUserModal({ open, onClose, editingUser, value, onChange, onSave, saving }: EditUserModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Editar Usuário">
      <div className="space-y-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            E-mail: <span className="font-medium text-slate-700 dark:text-slate-300">{editingUser?.email}</span>
          </p>
        </div>
        <div>
          <label className="label">Nome de exibição</label>
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
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Save size={14} /> Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
