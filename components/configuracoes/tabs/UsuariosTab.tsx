"use client";

import { Plus, User, ShieldCheck, ShieldX, Pencil, Lock, RotateCcw, Users } from "lucide-react";
import type { AppUser } from "@/types";

interface UsuariosTabProps {
  users: AppUser[];
  usersLoading: boolean;
  onAdd: () => void;
  onEdit: (user: AppUser) => void;
  onChangePassword: (user: AppUser) => void;
  onResetPassword: (user: AppUser) => void;
  onBan: (user: AppUser) => void;
}

export function UsuariosTab({ users, usersLoading, onAdd, onEdit, onChangePassword, onResetPassword, onBan }: UsuariosTabProps) {
  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Gerencie quem tem acesso ao app. Apenas admins podem criar, editar e desativar usuários.
        </p>
        <button onClick={onAdd}
          className="btn-primary flex items-center gap-1.5 shrink-0">
          <Plus size={14} /> Novo Usuário
        </button>
      </div>

      {usersLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id}
              className={`bg-white dark:bg-slate-800 border rounded-xl p-4 transition-all ${
                u.banned
                  ? "border-red-100 dark:border-red-900/30 opacity-70"
                  : "border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600"
              }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    u.role === "admin"
                      ? "bg-primary-50 dark:bg-primary-900/20"
                      : "bg-slate-100 dark:bg-slate-700"
                  }`}>
                    {u.role === "admin"
                      ? <ShieldCheck size={16} className="text-primary-600 dark:text-primary-400" />
                      : <User size={16} className="text-slate-500 dark:text-slate-400" />
                    }
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                        {u.display_name || u.email}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        u.role === "admin"
                          ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}>
                        {u.role === "admin" ? "Admin" : "Usuário"}
                      </span>
                      {u.banned && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                          Desativado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{u.email}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Criado em {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onEdit(u)}
                    title="Editar"
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <Pencil size={14} className="text-slate-400 dark:text-slate-500" />
                  </button>
                  <button
                    onClick={() => onChangePassword(u)}
                    title="Definir nova senha"
                    className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
                    <Lock size={14} className="text-primary-500" />
                  </button>
                  <button
                    onClick={() => onResetPassword(u)}
                    title="Enviar e-mail de reset"
                    className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors">
                    <RotateCcw size={14} className="text-amber-500" />
                  </button>
                  <button
                    onClick={() => onBan(u)}
                    title={u.banned ? "Ativar usuário" : "Desativar usuário"}
                    className={`p-2 rounded-lg transition-colors ${
                      u.banned
                        ? "hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        : "hover:bg-red-50 dark:hover:bg-red-900/20"
                    }`}>
                    {u.banned
                      ? <ShieldCheck size={14} className="text-emerald-500" />
                      : <ShieldX size={14} className="text-red-400" />
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-8 text-center transition-colors">
              <Users size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">Nenhum usuário encontrado</p>
              <button onClick={onAdd}
                className="btn-primary">Criar Usuário</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
