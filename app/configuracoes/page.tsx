"use client";

import { useEffect, useState } from "react";
import { TrendingUp, CreditCard, FileText, UserPlus, Users, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getIncomeSources, upsertIncomeSource, deleteIncomeSource,
  getCreditCards, upsertCreditCard,
  getFixedBills, upsertFixedBill, deleteFixedBill,
  getIncomeSourceAmounts, upsertIncomeSourceAmount, deleteIncomeSourceAmount,
} from "@/lib/queries";
import { formatCurrency } from "@/lib/utils";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { getOwners, saveOwners, slugify, DEFAULT_OWNERS, type Owner } from "@/lib/owners";
import type { IncomeSource, IncomeSourceAmount, CreditCard as CreditCardType, FixedBill, AppUser } from "@/types";

import { RendaTab } from "@/components/configuracoes/tabs/RendaTab";
import { CartoesTab } from "@/components/configuracoes/tabs/CartoesTab";
import { ContasTab } from "@/components/configuracoes/tabs/ContasTab";
import { IntegrantesTab } from "@/components/configuracoes/tabs/IntegrantesTab";
import { UsuariosTab } from "@/components/configuracoes/tabs/UsuariosTab";

import { SourceModal } from "@/components/configuracoes/SourceModal";
import { CardModal } from "@/components/configuracoes/CardModal";
import { BillModal } from "@/components/configuracoes/BillModal";
import { NewUserModal } from "@/components/configuracoes/NewUserModal";
import { EditUserModal } from "@/components/configuracoes/EditUserModal";
import { ChangePasswordModal } from "@/components/configuracoes/ChangePasswordModal";
import { ResetPasswordModal } from "@/components/configuracoes/ResetPasswordModal";
import { BanUserModal } from "@/components/configuracoes/BanUserModal";
import { HistoryModal, type NewAmountForm } from "@/components/configuracoes/HistoryModal";
import { DeleteConfirmModal, type DeleteTarget } from "@/components/configuracoes/DeleteConfirmModal";

type Tab = "renda" | "cartoes" | "contas" | "integrantes" | "usuarios";

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

  const [deleteConfirm, setDeleteConfirm] = useState<DeleteTarget | null>(null);

  // ── Histórico de valores de receita ─────────────────────────────────────────
  const [historyModal, setHistoryModal] = useState<IncomeSource | null>(null);
  const [historyAmounts, setHistoryAmounts] = useState<IncomeSourceAmount[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [newAmount, setNewAmount] = useState<NewAmountForm>({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: "", notes: "" });
  const [historySaving, setHistorySaving] = useState(false);

  // ── Integrantes ─────────────────────────────────────────────────────────────
  const [owners, setOwners] = useState<Owner[]>([]);
  const [newOwner, setNewOwner] = useState({ name: "", color: "#6366f1" });
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [ownerError, setOwnerError] = useState("");

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
    setOwners(getOwners());
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
      await upsertIncomeSource({ owner: owners[0]?.id ?? "casal", type: "salary", active: true, ...editSource });
      setSourceModal(false); setEditSource({});
      await loadAll(); showSaved();
    } catch (err: any) {
      console.error("Erro ao salvar fonte de renda:", err);
      setSaveError(err?.message ?? "Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function closeSourceModal() {
    setSourceModal(false); setEditSource({}); setSaveError("");
  }

  async function handleDeleteSource(id: string) {
    await deleteIncomeSource(id);
    setDeleteConfirm(null);
    await loadAll(); showSaved();
  }

  async function openHistory(src: IncomeSource) {
    setHistoryModal(src);
    setHistoryLoading(true);
    setNewAmount({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: "", notes: "" });
    const amts = await getIncomeSourceAmounts(src.id);
    setHistoryAmounts(amts);
    setHistoryLoading(false);
  }

  async function saveHistoryEntry() {
    if (!historyModal || !newAmount.amount) return;
    setHistorySaving(true);
    try {
      await upsertIncomeSourceAmount({
        source_id: historyModal.id,
        effective_month: newAmount.month,
        effective_year: newAmount.year,
        amount: parseFloat(newAmount.amount),
        notes: newAmount.notes || null,
      });
      const amts = await getIncomeSourceAmounts(historyModal.id);
      setHistoryAmounts(amts);
      setNewAmount(p => ({ ...p, amount: "", notes: "" }));
    } finally {
      setHistorySaving(false);
    }
  }

  async function removeHistoryEntry(id: string) {
    await deleteIncomeSourceAmount(id);
    if (historyModal) {
      const amts = await getIncomeSourceAmounts(historyModal.id);
      setHistoryAmounts(amts);
    }
  }

  async function saveCard() {
    if (!editCard.name || !editCard.due_day || !editCard.bank) return;
    setSaveError(""); setLoading(true);
    try {
      await upsertCreditCard({ color: "#6366f1", active: true, owner: owners[0]?.id ?? "heldem", ...editCard });
      setCardModal(false); setEditCard({});
      await loadAll(); showSaved();
    } catch (err: any) {
      console.error("Erro ao salvar cartão:", err);
      setSaveError(err?.message ?? "Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function closeCardModal() {
    setCardModal(false); setEditCard({}); setSaveError("");
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

  function closeBillModal() {
    setBillModal(false); setEditBill({}); setSaveError("");
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

  // ── Integrantes handlers ─────────────────────────────────────────────────────
  function addOwner() {
    const name = newOwner.name.trim();
    if (!name) { setOwnerError("Nome obrigatório"); return; }
    const id = slugify(name);
    if (!id) { setOwnerError("Nome inválido"); return; }
    const current = owners;
    if (current.find(o => o.id === id)) { setOwnerError("Já existe um integrante com esse nome"); return; }
    const updated = [...current, { id, name, color: newOwner.color }];
    saveOwners(updated);
    setOwners(updated);
    setNewOwner({ name: "", color: "#6366f1" });
    setOwnerError("");
    showSaved();
  }

  function updateOwner() {
    if (!editingOwner) return;
    const updated = owners.map(o => o.id === editingOwner.id ? editingOwner : o);
    saveOwners(updated);
    setOwners(updated);
    setEditingOwner(null);
    showSaved();
  }

  function removeOwner(id: string) {
    if (id === "casal") return; // protect Família
    const updated = owners.filter(o => o.id !== id);
    if (updated.length === 0) return;
    saveOwners(updated);
    setOwners(updated);
    showSaved();
  }

  function resetOwners() {
    saveOwners(DEFAULT_OWNERS);
    setOwners(DEFAULT_OWNERS);
    showSaved();
  }

  // Apenas contas sem parcelamento definido (recorrentes permanentes) aparecem na lista
  const listBills = bills.filter(b => !b.installment_total);

  const tabs: { key: Tab; label: string; icon: any; count: number; adminOnly?: boolean }[] = [
    { key: "renda", label: "Fontes de Renda", icon: TrendingUp, count: sources.filter(s => s.is_recurring !== false).length },
    { key: "cartoes", label: "Cartões de Crédito", icon: CreditCard, count: cards.length },
    { key: "contas", label: "Contas Fixas", icon: FileText, count: listBills.filter(b => b.active).length },
    { key: "integrantes", label: "Integrantes", icon: UserPlus, count: owners.length },
    { key: "usuarios", label: "Usuários", icon: Users, count: users.length, adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

  const billGroups = (() => {
    const map: Record<string, { label: string; order: number; bills: FixedBill[] }> = {};
    listBills.forEach(b => {
      const cat = b.category || "outros";
      const period = b.period ?? "sem-periodo";
      const key = `${cat}|${period}`;
      if (!map[key]) {
        const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
        const periodLabel = period === "1-15" ? " 1–15" : period === "16-30" ? " 16–30" : "";
        map[key] = {
          label: `${catLabel}${periodLabel}`,
          order: period === "1-15" ? 0 : period === "16-30" ? 1 : 2,
          bills: [],
        };
      }
      map[key].bills.push(b);
    });
    return Object.entries(map)
      .map(([key, { label, order, bills }]) => ({ key, label, order, bills }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "pt-BR"))
      .filter(g => g.bills.length > 0);
  })();

  const totalMonthlyBills = listBills.filter(b => b.active).reduce((s, b) => s + b.amount, 0);
  const totalMonthlyIncome = sources.filter(s => s.is_recurring !== false).reduce((s, s2) => s + s2.base_amount, 0);

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
          <p className="text-xs text-slate-400 dark:text-slate-500">{sources.filter(s => s.is_recurring !== false).length} fonte{sources.filter(s => s.is_recurring !== false).length !== 1 ? "s" : ""} recorrente{sources.filter(s => s.is_recurring !== false).length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl p-3 text-center transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Contas Fixas/mês</p>
          <p className="text-lg font-bold text-red-700 dark:text-red-400">{formatCurrency(totalMonthlyBills)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{listBills.filter(b => b.active).length} ativa{listBills.filter(b => b.active).length !== 1 ? "s" : ""}</p>
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
            <span className="sm:hidden">{key === "renda" ? "Renda" : key === "cartoes" ? "Cartões" : key === "contas" ? "Contas" : key === "integrantes" ? "Pessoas" : "Usuários"}</span>
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

      {tab === "renda" && (
        <RendaTab
          sources={sources}
          owners={owners}
          totalMonthlyIncome={totalMonthlyIncome}
          onAdd={() => { setEditSource({}); setSourceModal(true); }}
          onEdit={(src) => { setEditSource(src); setSourceModal(true); }}
          onDelete={(src) => setDeleteConfirm({ type: "source", id: src.id, name: src.name })}
          onHistory={openHistory}
        />
      )}

      {tab === "cartoes" && (
        <CartoesTab
          cards={cards}
          owners={owners}
          onAdd={() => { setEditCard({}); setCardModal(true); }}
          onEdit={(card) => { setEditCard(card); setCardModal(true); }}
          onToggleActive={toggleCardActive}
        />
      )}

      {tab === "contas" && (
        <ContasTab
          billGroups={billGroups}
          listBills={listBills}
          totalMonthlyBills={totalMonthlyBills}
          onAdd={() => { setEditBill({}); setBillModal(true); }}
          onEdit={(bill) => { setEditBill(bill); setBillModal(true); }}
          onDelete={(bill) => setDeleteConfirm({ type: "bill", id: bill.id, name: bill.name })}
          onToggleActive={toggleBillActive}
        />
      )}

      {tab === "integrantes" && (
        <IntegrantesTab
          owners={owners}
          newOwner={newOwner}
          onNewOwnerChange={(patch) => {
            setNewOwner(p => ({ ...p, ...patch }));
            if (patch.name !== undefined) setOwnerError("");
          }}
          editingOwner={editingOwner}
          onEditingOwnerChange={setEditingOwner}
          onStartEdit={setEditingOwner}
          onCancelEdit={() => setEditingOwner(null)}
          ownerError={ownerError}
          onAdd={addOwner}
          onUpdate={updateOwner}
          onRemove={removeOwner}
          onReset={resetOwners}
        />
      )}

      {tab === "usuarios" && isAdmin && (
        <UsuariosTab
          users={users}
          usersLoading={usersLoading}
          onAdd={() => { setNewUser({ email: "", password: "", display_name: "", role: "user" }); setUserModal(true); }}
          onEdit={(u) => { setEditingUser(u); setEditUserData({ display_name: u.display_name, role: u.role }); setEditUserModal(true); }}
          onChangePassword={(u) => { setChangePasswordUser(u); setNewPassword(""); setShowChangePassword(false); }}
          onResetPassword={setResetConfirm}
          onBan={setBanConfirm}
        />
      )}

      <SourceModal
        open={sourceModal}
        onClose={closeSourceModal}
        value={editSource}
        onChange={(patch) => setEditSource(p => ({ ...p, ...patch }))}
        onSave={saveSource}
        saving={loading}
        error={saveError}
        owners={owners}
      />

      <CardModal
        open={cardModal}
        onClose={closeCardModal}
        value={editCard}
        onChange={(patch) => setEditCard(p => ({ ...p, ...patch }))}
        onSave={saveCard}
        saving={loading}
        error={saveError}
        owners={owners}
      />

      <BillModal
        open={billModal}
        onClose={closeBillModal}
        value={editBill}
        onChange={(patch) => setEditBill(p => ({ ...p, ...patch }))}
        onSave={saveBill}
        saving={loading}
        error={saveError}
      />

      <NewUserModal
        open={userModal}
        onClose={() => setUserModal(false)}
        value={newUser}
        onChange={(patch) => setNewUser(p => ({ ...p, ...patch }))}
        onSave={createUser}
        saving={loading}
        showPassword={showNewPassword}
        onToggleShowPassword={() => setShowNewPassword(v => !v)}
      />

      <EditUserModal
        open={editUserModal}
        onClose={() => { setEditUserModal(false); setEditingUser(null); }}
        editingUser={editingUser}
        value={editUserData}
        onChange={(patch) => setEditUserData(p => ({ ...p, ...patch }))}
        onSave={updateUser}
        saving={loading}
      />

      <ChangePasswordModal
        user={changePasswordUser}
        onClose={() => { setChangePasswordUser(null); setNewPassword(""); }}
        newPassword={newPassword}
        onNewPasswordChange={setNewPassword}
        onSave={changePassword}
        saving={loading}
        showPassword={showChangePassword}
        onToggleShowPassword={() => setShowChangePassword(v => !v)}
      />

      <ResetPasswordModal
        user={resetConfirm}
        onClose={() => setResetConfirm(null)}
        onConfirm={sendResetPassword}
      />

      <BanUserModal
        user={banConfirm}
        onClose={() => setBanConfirm(null)}
        onConfirm={toggleBanUser}
      />

      <HistoryModal
        source={historyModal}
        onClose={() => setHistoryModal(null)}
        amounts={historyAmounts}
        loading={historyLoading}
        newAmount={newAmount}
        onNewAmountChange={(patch) => setNewAmount(p => ({ ...p, ...patch }))}
        onSaveEntry={saveHistoryEntry}
        saving={historySaving}
        onRemoveEntry={removeHistoryEntry}
      />

      <DeleteConfirmModal
        target={deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={(t) => {
          if (t.type === "source") handleDeleteSource(t.id);
          if (t.type === "bill") handleDeleteBill(t.id);
        }}
      />
    </div>
  );
}
