"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, CreditCard, FileText, Plus, Pencil, Trash2,
  Save, AlertCircle, Check, User, Banknote, Users,
  ShieldCheck, ShieldX, RotateCcw, Eye, EyeOff, Lock,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import {
  getIncomeSources, upsertIncomeSource, deleteIncomeSource,
  getCreditCards, upsertCreditCard,
  getFixedBills, upsertFixedBill, deleteFixedBill,
} from "@/lib/queries";
import { formatCurrency } from "@/lib/utils";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { IncomeSource, CreditCard as CreditCardType, FixedBill, AppUser } from "@/types";

type Tab = "renda" | "cartoes" | "contas" | "usuarios";

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>("renda");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [bills, setBills] = useState<FixedBill[]>([]);

  const [sourceModal, setSourceModal] = useState(false);
  const [cardModal, setCardModal] = useState(false);
  const [billModal, setBillModal] = useState(false);

  const [editSource, setEditSource] = useState<Partial<IncomeSource>>({});
  const [editCard, setEditCard] = useState<Partial<CreditCardType>>({});
  const [editBill, setEditBill] = useState<Partial<FixedBill>>({});

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);

  // ── Users (admin only) ──────────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [editUserModal, setEditUserModal] = useState(false);
  const [resetConfirm, setResetConfirm] = useState<AppUser | null>(null);
  const [banConfirm, setBanConfirm] = useState<AppUser | null>(null);
  const [newUser, setNewUser] = useState({ email: "", password: "", display_name: "", role: "user" as "admin" | "user" });
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editUserData, setEditUserData] = useState({ display_name: "", role: "user" as "admin" | "user" });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changePasswordUser, setChangePasswordUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [userFeedback, setUserFeedback] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    loadAll();
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const supabase = createSupabaseBrowser();
    const { data } = await supabase.auth.getUser();
    if (data.user?.user_metadata?.role === "admin") {
      setIsAdmin(true);
    }
  }

  async function loadAll() {
    const [srcs, cs, bls] = await Promise.all([
      getIncomeSources(), getCreditCards(), getFixedBills(),
    ]);
    setSources(srcs); setCards(cs); setBills(bls);
  }

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function loadUsers() {
    setUsersLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
    setUsersLoading(false);
  }

  async function saveSource() {
    if (!editSource.name || !editSource.base_amount) return;
    setSaveError(""); setLoading(true);
    try {
      await upsertIncomeSource({ owner: "casal", type: "salary", active: true, ...editSource });
      setSourceModal(false); setEditSource({});
      await loadAll(); showSaved();
    } catch (err: any) {
      console.error("Erro ao salvar fonte de renda:", err);
      setSaveError(err?.message ?? "Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSource(id: string) {
    await deleteIncomeSource(id);
    setDeleteConfirm(null);
    await loadAll(); showSaved();
  }

  async function saveCard() {
    if (!editCard.name || !editCard.due_day || !editCard.bank) return;
    setSaveError(""); setLoading(true);
    try {
      await upsertCreditCard({ color: "#6366f1", active: true, owner: "pessoa1", ...editCard });
      setCardModal(false); setEditCard({});
      await loadAll(); showSaved();
    } catch (err: any) {
      console.error("Erro ao salvar cartão:", err);
      setSaveError(err?.message ?? "Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleCardActive(card: CreditCardType) {
    await upsertCreditCard({ ...card, active: !card.active });
    await loadAll();
  }

  async function saveBill() {
    if (!editBill.name || !editBill.amount) return;
    setSaveError(""); setLoading(true);
    try {
      await upsertFixedBill({ category: "essencial", active: true, ...editBill });
      setBillModal(false); setEditBill({});
      await loadAll(); showSaved();
    } catch (err: any) {
      console.error("Erro ao salvar conta:", err);
      setSaveError(err?.message ?? "Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBill(id: string) {
    await deleteFixedBill(id);
    setDeleteConfirm(null);
    await loadAll(); showSaved();
  }

  async function toggleBillActive(bill: FixedBill) {
    await upsertFixedBill({ ...bill, active: !bill.active });
    await loadAll();
  }

  async function createUser() {
    if (!newUser.email || !newUser.password) return;
    setLoading(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      setUserModal(false);
      setNewUser({ email: "", password: "", display_name: "", role: "user" });
      await loadUsers();
      showFeedback("Usuário criado com sucesso!");
    } else {
      const err = await res.json();
      showFeedback(err.error ?? "Erro ao criar usuário");
    }
    setLoading(false);
  }

  async function updateUser() {
    if (!editingUser) return;
    setLoading(true);
    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editUserData),
    });
    if (res.ok) {
      setEditUserModal(false);
      setEditingUser(null);
      await loadUsers();
      showFeedback("Usuário atualizado!");
    }
    setLoading(false);
  }

  async function toggleBanUser(user: AppUser) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned: !user.banned }),
    });
    setBanConfirm(null);
    await loadUsers();
    showFeedback(user.banned ? "Usuário ativado!" : "Usuário desativado!");
  }

  async function sendResetPassword(user: AppUser) {
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "POST" });
    setResetConfirm(null);
    if (res.ok) showFeedback("E-mail de redefinição enviado!");
    else showFeedback("Erro ao enviar e-mail");
  }

  async function changePassword() {
    if (!changePasswordUser || !newPassword) return;
    setLoading(true);
    const res = await fetch(`/api/admin/users/${changePasswordUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    if (res.ok) {
      setChangePasswordUser(null);
      setNewPassword("");
      showFeedback("Senha alterada com sucesso!");
    } else {
      const err = await res.json();
      showFeedback(err.error ?? "Erro ao alterar senha");
    }
    setLoading(false);
  }

  function showFeedback(msg: string) {
    setUserFeedback(msg);
    setTimeout(() => setUserFeedback(""), 3000);
  }

  const tabs: { key: Tab; label: string; icon: any; count: number; adminOnly?: boolean }[] = [
    { key: "renda", label: "Fontes de Renda", icon: TrendingUp, count: sources.length },
    { key: "cartoes", label: "Cartões de Crédito", icon: CreditCard, count: cards.length },
    { key: "contas", label: "Contas Fixas", icon: FileText, count: bills.length },
    { key: "usuarios", label: "Usuários", icon: Users, count: users.length, adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

  const billGroups = [
    { key: "essencial-1-15", label: "Essenciais 1–15", bills: bills.filter(b => b.category === "essencial" && b.period === "1-15") },
    { key: "outros-1-15", label: "Outros 1–15", bills: bills.filter(b => b.category === "outros" && b.period === "1-15") },
    { key: "essencial-16-30", label: "Essenciais 16–30", bills: bills.filter(b => b.category === "essencial" && b.period === "16-30") },
    { key: "outros-16-30", label: "Outros 16–30", bills: bills.filter(b => b.category === "outros" && b.period === "16-30") },
    { key: "sem-periodo", label: "Sem Período", bills: bills.filter(b => !b.period) },
  ].filter(g => g.bills.length > 0);

  const totalMonthlyBills = bills.filter(b => b.active).reduce((s, b) => s + b.amount, 0);
  const totalMonthlyIncome = sources.reduce((s, s2) => s + s2.base_amount, 0);

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <PageHeader title="Configurações" subtitle="Gerencie suas fontes de renda, cartões e contas fixas">
        {(saved || userFeedback) && (
          <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 px-3 py-1.5 rounded-lg text-sm font-medium">
            <Check size={14} /> {userFeedback || "Salvo!"}
          </div>
        )}
      </PageHeader>

      {/* Summary bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3 text-center transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Renda Mensal Base</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalMonthlyIncome)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{sources.length} fonte{sources.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3 text-center transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Contas Fixas/mês</p>
          <p className="text-lg font-bold text-red-700 dark:text-red-400">{formatCurrency(totalMonthlyBills)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{bills.filter(b => b.active).length} ativa{bills.filter(b => b.active).length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3 text-center transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Cartões Cadastrados</p>
          <p className="text-lg font-bold text-primary-700 dark:text-primary-400">{cards.length}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{cards.filter(c => c.active).length} ativo{cards.filter(c => c.active).length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 p-1 rounded-xl w-fit transition-colors">
        {visibleTabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => { setTab(key); if (key === "usuarios" && users.length === 0) loadUsers(); }}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? "bg-primary-600 text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            }`}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{key === "renda" ? "Renda" : key === "cartoes" ? "Cartões" : key === "contas" ? "Contas" : "Usuários"}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              tab === key
                ? "bg-primary-500 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── RENDA ── */}
      {tab === "renda" && (
        <div className="max-w-2xl">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure suas fontes de renda fixas. Elas serão usadas como base para cada mês.
            </p>
            <button onClick={() => { setEditSource({}); setSourceModal(true); }}
              className="btn-primary flex items-center gap-1.5 shrink-0">
              <Plus size={14} /> Adicionar
            </button>
          </div>

          <div className="space-y-2">
            {sources.map((src) => (
              <div key={src.id}
                className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-4 flex items-center justify-between hover:border-slate-200 dark:hover:border-slate-600 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    src.owner === "pessoa1" ? "bg-primary-50 dark:bg-primary-900/20" :
                    src.owner === "pessoa2" ? "bg-pink-50 dark:bg-pink-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"
                  }`}>
                    <User size={15} className={
                      src.owner === "pessoa1" ? "text-primary-600 dark:text-primary-400" :
                      src.owner === "pessoa2" ? "text-pink-600 dark:text-pink-400" : "text-emerald-600 dark:text-emerald-400"
                    } />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">{src.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        src.owner === "pessoa1" ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400" :
                        src.owner === "pessoa2" ? "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400" :
                        "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                      }`}>
                        {src.owner.charAt(0).toUpperCase() + src.owner.slice(1)}
                      </span>
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                        {src.type === "salary" ? "Salário" : src.type === "extra" ? "Extra" : "Outro"}
                      </span>
                      {src.due_day && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">Dia {src.due_day}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(src.base_amount)}</p>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditSource(src); setSourceModal(true); }}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                      <Pencil size={14} className="text-slate-400 dark:text-slate-500" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: "source", id: src.id, name: src.name })}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {sources.length === 0 && (
              <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-8 text-center transition-colors">
                <Banknote size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">Nenhuma fonte de renda cadastrada</p>
                <button onClick={() => { setEditSource({}); setSourceModal(true); }}
                  className="btn-primary">Adicionar Fonte</button>
              </div>
            )}
          </div>

          {sources.length > 0 && (
            <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-3 flex justify-between transition-colors">
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Renda Mensal Total</span>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalMonthlyIncome)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── CARTÕES ── */}
      {tab === "cartoes" && (
        <div className="max-w-3xl">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cartões de crédito cadastrados. O dia de vencimento é usado para alertas de pagamento.
            </p>
            <button onClick={() => { setEditCard({}); setCardModal(true); }}
              className="btn-primary flex items-center gap-1.5 shrink-0">
              <Plus size={14} /> Novo Cartão
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {cards.map((card) => (
              <div key={card.id}
                className={`bg-white dark:bg-slate-800 border rounded-xl p-4 transition-all ${
                  card.active
                    ? "border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600"
                    : "border-slate-100 dark:border-slate-700/50 opacity-60"
                }`}>
                <div
                  className="h-14 rounded-lg mb-3 flex items-center justify-between px-3"
                  style={{ background: `linear-gradient(135deg, ${card.color}cc, ${card.color})` }}
                >
                  <div>
                    <p className="text-white font-bold text-sm">{card.name}</p>
                    <p className="text-white/70 text-xs">{card.bank}</p>
                  </div>
                  <CreditCard size={20} className="text-white/70" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        card.owner === "pessoa1"
                          ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400"
                          : "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400"
                      }`}>
                        {card.owner.charAt(0).toUpperCase() + card.owner.slice(1)}
                      </span>
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full font-medium">
                        Vence dia {card.due_day}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs text-slate-400 dark:text-slate-500">Ativo</span>
                      <Toggle size="sm" checked={card.active} onChange={() => toggleCardActive(card)} />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditCard(card); setCardModal(true); }}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                      <Pencil size={14} className="text-slate-400 dark:text-slate-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {cards.length === 0 && (
              <div className="col-span-2 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-8 text-center transition-colors">
                <CreditCard size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">Nenhum cartão cadastrado</p>
                <button onClick={() => { setEditCard({}); setCardModal(true); }}
                  className="btn-primary">Adicionar Cartão</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONTAS FIXAS ── */}
      {tab === "contas" && (
        <div className="max-w-3xl">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Contas recorrentes mensais. Organize por período e categoria para melhor controle.
            </p>
            <button onClick={() => { setEditBill({}); setBillModal(true); }}
              className="btn-primary flex items-center gap-1.5 shrink-0">
              <Plus size={14} /> Nova Conta
            </button>
          </div>

          <div className="space-y-4">
            {billGroups.map(({ key, label, bills: groupBills }) => (
              <div key={key} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl overflow-hidden transition-colors">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{label}</h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      {formatCurrency(groupBills.filter(b => b.active).reduce((s, b) => s + b.amount, 0))}
                    </span>
                  </div>
                </div>
                <div>
                  {groupBills.map((bill) => (
                    <div key={bill.id}
                      className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 dark:border-slate-700/30 last:border-0 ${
                        !bill.active ? "opacity-50" : ""
                      }`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          bill.category === "essencial"
                            ? "bg-primary-50 dark:bg-primary-900/20"
                            : "bg-amber-50 dark:bg-amber-900/20"
                        }`}>
                          <FileText size={13} className={
                            bill.category === "essencial"
                              ? "text-primary-600 dark:text-primary-400"
                              : "text-amber-600 dark:text-amber-400"
                          } />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{bill.name}</p>
                            {!bill.active && (
                              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full shrink-0">
                                inativa
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {bill.due_day && (
                              <span className="text-xs text-slate-400 dark:text-slate-500">Dia {bill.due_day}</span>
                            )}
                            {bill.installment_current && (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                · Parcela {bill.installment_current}/{bill.installment_total}
                              </span>
                            )}
                            {bill.notes && (
                              <span className="text-xs text-slate-400 dark:text-slate-500">· {bill.notes}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 shrink-0">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(bill.amount)}</p>
                        <Toggle size="sm" checked={bill.active} onChange={() => toggleBillActive(bill)} />
                        <div className="flex gap-1">
                          <button onClick={() => { setEditBill(bill); setBillModal(true); }}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                            <Pencil size={13} className="text-slate-400 dark:text-slate-500" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: "bill", id: bill.id, name: bill.name })}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {bills.length === 0 && (
              <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-8 text-center transition-colors">
                <FileText size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">Nenhuma conta cadastrada</p>
                <button onClick={() => { setEditBill({}); setBillModal(true); }}
                  className="btn-primary">Adicionar Conta</button>
              </div>
            )}
          </div>

          {bills.length > 0 && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-xl p-3 flex justify-between transition-colors">
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">Total Mensal (contas ativas)</span>
              <span className="text-lg font-bold text-red-700 dark:text-red-400">{formatCurrency(totalMonthlyBills)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── USUÁRIOS ── */}
      {tab === "usuarios" && isAdmin && (
        <div className="max-w-3xl">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gerencie quem tem acesso ao app. Apenas admins podem criar, editar e desativar usuários.
            </p>
            <button onClick={() => { setNewUser({ email: "", password: "", display_name: "", role: "user" }); setUserModal(true); }}
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
                        onClick={() => { setEditingUser(u); setEditUserData({ display_name: u.display_name, role: u.role }); setEditUserModal(true); }}
                        title="Editar"
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <Pencil size={14} className="text-slate-400 dark:text-slate-500" />
                      </button>
                      <button
                        onClick={() => { setChangePasswordUser(u); setNewPassword(""); setShowChangePassword(false); }}
                        title="Definir nova senha"
                        className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
                        <Lock size={14} className="text-primary-500" />
                      </button>
                      <button
                        onClick={() => setResetConfirm(u)}
                        title="Enviar e-mail de reset"
                        className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors">
                        <RotateCcw size={14} className="text-amber-500" />
                      </button>
                      <button
                        onClick={() => setBanConfirm(u)}
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
                  <button onClick={() => { setNewUser({ email: "", password: "", display_name: "", role: "user" }); setUserModal(true); }}
                    className="btn-primary">Criar Usuário</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: Fonte de Renda ── */}
      <Modal open={sourceModal} onClose={() => { setSourceModal(false); setEditSource({}); }}
        title={editSource.id ? "Editar Fonte de Renda" : "Nova Fonte de Renda"}>
        <div className="space-y-3">
          <div>
            <label className="label">Nome</label>
            <input className="input" placeholder="Ex: Salário Pessoa 1"
              value={editSource.name ?? ""}
              onChange={e => setEditSource(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Valor Base (R$)</label>
              <input className="input" type="number" step="0.01"
                value={editSource.base_amount ?? ""}
                onChange={e => setEditSource(p => ({ ...p, base_amount: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Dia de Recebimento</label>
              <input className="input" type="number" min="1" max="31" placeholder="15"
                value={editSource.due_day ?? ""}
                onChange={e => setEditSource(p => ({ ...p, due_day: Number(e.target.value) || null }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Responsável</label>
              <select className="input" value={editSource.owner ?? "casal"}
                onChange={e => setEditSource(p => ({ ...p, owner: e.target.value as any }))}>
                <option value="pessoa1">Pessoa 1</option>
                <option value="pessoa2">Pessoa 2</option>
                <option value="casal">Casal</option>
              </select>
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={editSource.type ?? "salary"}
                onChange={e => setEditSource(p => ({ ...p, type: e.target.value as any }))}>
                <option value="salary">Salário</option>
                <option value="extra">Extra</option>
                <option value="other">Outro</option>
              </select>
            </div>
          </div>
          {saveError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setSourceModal(false); setEditSource({}); setSaveError(""); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveSource} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Cartão ── */}
      <Modal open={cardModal} onClose={() => { setCardModal(false); setEditCard({}); setSaveError(""); }}
        title={editCard.id ? "Editar Cartão" : "Novo Cartão de Crédito"}>
        <div className="space-y-3">
          <div
            className="h-16 rounded-xl flex items-center justify-between px-4"
            style={{ background: `linear-gradient(135deg, ${(editCard.color ?? "#6366f1") + "cc"}, ${editCard.color ?? "#6366f1"})` }}
          >
            <div>
              <p className="text-white font-bold text-sm">{editCard.name || "Nome do Cartão"}</p>
              <p className="text-white/70 text-xs">{editCard.bank || "Banco"}</p>
            </div>
            <CreditCard size={20} className="text-white/70" />
          </div>

          <div>
            <label className="label">Nome do Cartão</label>
            <input className="input" placeholder="Ex: NUBANK P1"
              value={editCard.name ?? ""}
              onChange={e => setEditCard(p => ({ ...p, name: e.target.value.toUpperCase() }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Banco</label>
              <input className="input" placeholder="Ex: Nubank"
                value={editCard.bank ?? ""}
                onChange={e => setEditCard(p => ({ ...p, bank: e.target.value }))} />
            </div>
            <div>
              <label className="label">Dia Vencimento</label>
              <input className="input" type="number" min="1" max="31"
                value={editCard.due_day ?? ""}
                onChange={e => setEditCard(p => ({ ...p, due_day: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Titular</label>
              <select className="input" value={editCard.owner ?? "pessoa1"}
                onChange={e => setEditCard(p => ({ ...p, owner: e.target.value as any }))}>
                <option value="pessoa1">Pessoa 1</option>
                <option value="pessoa2">Pessoa 2</option>
                <option value="casal">Casal</option>
              </select>
            </div>
            <div>
              <label className="label">Cor do Cartão</label>
              <div className="flex items-center gap-2">
                <input className="h-9 w-12 rounded border border-slate-200 dark:border-slate-600 cursor-pointer" type="color"
                  value={editCard.color ?? "#6366f1"}
                  onChange={e => setEditCard(p => ({ ...p, color: e.target.value }))} />
                <input className="input flex-1" placeholder="#6366f1"
                  value={editCard.color ?? "#6366f1"}
                  onChange={e => setEditCard(p => ({ ...p, color: e.target.value }))} />
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#10b981", "#06b6d4"].map(c => (
                  <button key={c} onClick={() => setEditCard(p => ({ ...p, color: c }))}
                    className="w-5 h-5 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: editCard.color === c ? "white" : "transparent",
                      boxShadow: editCard.color === c ? `0 0 0 2px ${c}` : "none",
                    }} />
                ))}
              </div>
            </div>
          </div>
          {saveError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setCardModal(false); setEditCard({}); setSaveError(""); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveCard} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Conta Fixa ── */}
      <Modal open={billModal} onClose={() => { setBillModal(false); setEditBill({}); setSaveError(""); }}
        title={editBill.id ? "Editar Conta Fixa" : "Nova Conta Fixa"} size="lg">
        <div className="space-y-3">
          <div>
            <label className="label">Nome da Conta</label>
            <input className="input" placeholder="Ex: Condomínio"
              value={editBill.name ?? ""}
              onChange={e => setEditBill(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Valor da Parcela (R$)</label>
              <input className="input" type="number" step="0.01"
                value={editBill.amount ?? ""}
                onChange={e => setEditBill(p => ({ ...p, amount: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Dia de Vencimento</label>
              <input className="input" type="number" min="1" max="31"
                value={editBill.due_day ?? ""}
                onChange={e => {
                  const day = Number(e.target.value) || null;
                  const autoPeriod = day ? (day <= 15 ? "1-15" : "16-30") : undefined;
                  setEditBill(p => ({ ...p, due_day: day, ...(autoPeriod ? { period: autoPeriod as any } : {}) }));
                }} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={editBill.category ?? "essencial"}
                onChange={e => setEditBill(p => ({ ...p, category: e.target.value as any }))}>
                <option value="essencial">Essencial</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="label">Período do Mês</label>
              <select className="input" value={editBill.period ?? ""}
                onChange={e => setEditBill(p => ({ ...p, period: e.target.value as any || null }))}>
                <option value="">Sem período</option>
                <option value="1-15">1 a 15</option>
                <option value="16-30">16 a 30</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Parcela Atual</label>
              <input className="input" type="number" placeholder="—"
                value={editBill.installment_current ?? ""}
                onChange={e => setEditBill(p => ({ ...p, installment_current: Number(e.target.value) || null }))} />
            </div>
            <div>
              <label className="label">Total Parcelas</label>
              <input className="input" type="number" placeholder="—"
                value={editBill.installment_total ?? ""}
                onChange={e => setEditBill(p => ({ ...p, installment_total: Number(e.target.value) || null }))} />
            </div>
            <div>
              <label className="label">Observações</label>
              <input className="input" placeholder="Notas"
                value={editBill.notes ?? ""}
                onChange={e => setEditBill(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>

          {saveError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setBillModal(false); setEditBill({}); setSaveError(""); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveBill} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Novo Usuário ── */}
      <Modal open={userModal} onClose={() => setUserModal(false)}
        title="Criar Novo Usuário">
        <div className="space-y-3">
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" placeholder="usuario@email.com"
              value={newUser.email}
              onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Senha</label>
            <div className="relative">
              <input className="input pr-10" type={showNewPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres"
                value={newUser.password}
                onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
              <button type="button" tabIndex={-1}
                onClick={() => setShowNewPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Nome (opcional)</label>
              <input className="input" placeholder="Ex: João"
                value={newUser.display_name}
                onChange={e => setNewUser(p => ({ ...p, display_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Permissão</label>
              <select className="input" value={newUser.role}
                onChange={e => setNewUser(p => ({ ...p, role: e.target.value as any }))}>
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
            <button onClick={() => setUserModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={createUser} disabled={loading || !newUser.email || !newUser.password}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Users size={14} /> Criar Usuário
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Editar Usuário ── */}
      <Modal open={editUserModal} onClose={() => { setEditUserModal(false); setEditingUser(null); }}
        title="Editar Usuário">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              E-mail: <span className="font-medium text-slate-700 dark:text-slate-300">{editingUser?.email}</span>
            </p>
          </div>
          <div>
            <label className="label">Nome de exibição</label>
            <input className="input" placeholder="Ex: João"
              value={editUserData.display_name}
              onChange={e => setEditUserData(p => ({ ...p, display_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Permissão</label>
            <select className="input" value={editUserData.role}
              onChange={e => setEditUserData(p => ({ ...p, role: e.target.value as any }))}>
              <option value="user">Usuário comum</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setEditUserModal(false); setEditingUser(null); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={updateUser} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Save size={14} /> Salvar
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Alterar Senha ── */}
      <Modal open={!!changePasswordUser} onClose={() => { setChangePasswordUser(null); setNewPassword(""); }} title="Definir Nova Senha" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Usuário: <span className="font-medium text-slate-700 dark:text-slate-300">{changePasswordUser?.email}</span>
          </p>
          <div>
            <label className="label">Nova Senha</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showChangePassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoFocus
              />
              <button type="button" tabIndex={-1}
                onClick={() => setShowChangePassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                {showChangePassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setChangePasswordUser(null); setNewPassword(""); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={changePassword} disabled={loading || newPassword.length < 6}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Lock size={14} /> Salvar Senha
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Reset Senha ── */}
      <Modal open={!!resetConfirm} onClose={() => setResetConfirm(null)} title="Redefinir Senha" size="sm">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto">
            <RotateCcw size={22} className="text-amber-500" />
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Enviar e-mail de redefinição de senha para</p>
            <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">{resetConfirm?.email}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setResetConfirm(null)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => resetConfirm && sendResetPassword(resetConfirm)}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
              <RotateCcw size={14} /> Enviar
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Ban/Unban ── */}
      <Modal open={!!banConfirm} onClose={() => setBanConfirm(null)} title={banConfirm?.banned ? "Ativar Usuário" : "Desativar Usuário"} size="sm">
        <div className="text-center space-y-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
            banConfirm?.banned ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-red-50 dark:bg-red-900/20"
          }`}>
            {banConfirm?.banned
              ? <ShieldCheck size={22} className="text-emerald-500" />
              : <ShieldX size={22} className="text-red-500" />
            }
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {banConfirm?.banned ? "Reativar acesso de" : "Bloquear acesso de"}
            </p>
            <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">{banConfirm?.email}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setBanConfirm(null)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => banConfirm && toggleBanUser(banConfirm)}
              className={`flex-1 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 ${
                banConfirm?.banned
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}>
              {banConfirm?.banned ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
              {banConfirm?.banned ? "Ativar" : "Desativar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Confirmar Exclusão ── */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        title="Confirmar Exclusão" size="sm">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={22} className="text-red-500" />
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Tem certeza que deseja remover</p>
            <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">"{deleteConfirm?.name}"?</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Esta ação irá desativar o item. O histórico de pagamentos será preservado.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!deleteConfirm) return;
                if (deleteConfirm.type === "source") handleDeleteSource(deleteConfirm.id);
                if (deleteConfirm.type === "bill") handleDeleteBill(deleteConfirm.id);
              }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Trash2 size={14} /> Remover
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
