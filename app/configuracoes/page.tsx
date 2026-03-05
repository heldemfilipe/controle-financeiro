"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, CreditCard, FileText, Plus, Pencil, Trash2,
  Save, AlertCircle, Check, User, Banknote,
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
import type { IncomeSource, CreditCard as CreditCardType, FixedBill } from "@/types";

type Tab = "renda" | "cartoes" | "contas";

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

  useEffect(() => { loadAll(); }, []);

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

  async function saveSource() {
    if (!editSource.name || !editSource.base_amount) return;
    setLoading(true);
    await upsertIncomeSource({ owner: "casal", type: "salary", active: true, ...editSource });
    setSourceModal(false); setEditSource({});
    await loadAll(); setLoading(false); showSaved();
  }

  async function handleDeleteSource(id: string) {
    await deleteIncomeSource(id);
    setDeleteConfirm(null);
    await loadAll(); showSaved();
  }

  async function saveCard() {
    if (!editCard.name || !editCard.due_day || !editCard.bank) return;
    setLoading(true);
    await upsertCreditCard({ color: "#6366f1", active: true, owner: "pessoa1", ...editCard });
    setCardModal(false); setEditCard({});
    await loadAll(); setLoading(false); showSaved();
  }

  async function toggleCardActive(card: CreditCardType) {
    await upsertCreditCard({ ...card, active: !card.active });
    await loadAll();
  }

  async function saveBill() {
    if (!editBill.name || !editBill.amount) return;
    setLoading(true);
    await upsertFixedBill({ category: "essencial", active: true, ...editBill });
    setBillModal(false); setEditBill({});
    await loadAll(); setLoading(false); showSaved();
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

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: "renda", label: "Fontes de Renda", icon: TrendingUp, count: sources.length },
    { key: "cartoes", label: "Cartões de Crédito", icon: CreditCard, count: cards.length },
    { key: "contas", label: "Contas Fixas", icon: FileText, count: bills.length },
  ];

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
    <div className="p-6 min-h-screen">
      <PageHeader title="Configurações" subtitle="Gerencie suas fontes de renda, cartões e contas fixas">
        {saved && (
          <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 px-3 py-1.5 rounded-lg text-sm font-medium animate-pulse">
            <Check size={14} /> Salvo!
          </div>
        )}
      </PageHeader>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
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
      <div className="flex gap-1 mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 p-1 rounded-xl w-fit transition-colors">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? "bg-primary-600 text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            }`}
          >
            <Icon size={14} />
            {label}
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
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    src.owner === "pessoa1" ? "bg-primary-50 dark:bg-primary-900/20" :
                    src.owner === "pessoa2" ? "bg-pink-50 dark:bg-pink-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"
                  }`}>
                    <User size={15} className={
                      src.owner === "pessoa1" ? "text-primary-600 dark:text-primary-400" :
                      src.owner === "pessoa2" ? "text-pink-600 dark:text-pink-400" : "text-emerald-600 dark:text-emerald-400"
                    } />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{src.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
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
                <div className="flex items-center gap-3">
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
                {/* Card visual */}
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
                    <div className="flex items-center gap-2">
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
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
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
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{bill.name}</p>
                            {!bill.active && (
                              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                                inativa
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
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
                      <div className="flex items-center gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setSourceModal(false); setEditSource({}); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveSource} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Save size={14} /> Salvar
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Cartão ── */}
      <Modal open={cardModal} onClose={() => { setCardModal(false); setEditCard({}); }}
        title={editCard.id ? "Editar Cartão" : "Novo Cartão de Crédito"}>
        <div className="space-y-3">
          {/* Preview */}
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Titular</label>
              <select className="input" value={editCard.owner ?? "pessoa1"}
                onChange={e => setEditCard(p => ({ ...p, owner: e.target.value as any }))}>
                <option value="pessoa1">Pessoa 1</option>
                <option value="pessoa2">Pessoa 2</option>
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
                {["#ff6900", "#820AD1", "#003087", "#e64600", "#005ea5", "#6366f1", "#10b981"].map(c => (
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
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setCardModal(false); setEditCard({}); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveCard} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Save size={14} /> Salvar
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Conta Fixa ── */}
      <Modal open={billModal} onClose={() => { setBillModal(false); setEditBill({}); }}
        title={editBill.id ? "Editar Conta Fixa" : "Nova Conta Fixa"} size="lg">
        <div className="space-y-3">
          <div>
            <label className="label">Nome da Conta</label>
            <input className="input" placeholder="Ex: Condomínio"
              value={editBill.name ?? ""}
              onChange={e => setEditBill(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor Mensal (R$)</label>
              <input className="input" type="number" step="0.01"
                value={editBill.amount ?? ""}
                onChange={e => setEditBill(p => ({ ...p, amount: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Dia de Vencimento</label>
              <input className="input" type="number" min="1" max="31"
                value={editBill.due_day ?? ""}
                onChange={e => setEditBill(p => ({ ...p, due_day: Number(e.target.value) || null }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-3 gap-3">
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
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setBillModal(false); setEditBill({}); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveBill} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Save size={14} /> Salvar
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
