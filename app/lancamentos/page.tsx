"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, TrendingUp, FileText, CreditCard, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import {
  getIncomeSources, upsertIncomeSource, deleteIncomeSource,
  getFixedBills, upsertFixedBill, deleteFixedBill,
  getCategories, upsertCategory, deleteCategory,
  getCreditCards, upsertCreditCard,
  getCardTransactions, upsertCardTransaction, deleteCardTransaction,
  insertCardTransactions,
  getMonthlyIncomes, upsertMonthlyIncome, toggleIncomeReceived,
} from "@/lib/queries";
import { MONTHS } from "@/types";
import { formatCurrency, getCurrentMonth, installmentEndDate, computeInstallment } from "@/lib/utils";
import type {
  IncomeSource, FixedBill, CreditCard as CreditCardType,
  CardTransaction, MonthlyIncome, Category,
} from "@/types";

type Tab = "receitas" | "contas" | "cartoes";

export default function LancamentosPage() {
  const { month: cm, year: cy } = getCurrentMonth();
  const [month, setMonth] = useState(cm);
  const [year, setYear] = useState(cy);
  const [tab, setTab] = useState<Tab>("receitas");

  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [fixedBills,    setFixedBills]    = useState<FixedBill[]>([]);
  const [creditCards,   setCreditCards]   = useState<CreditCardType[]>([]);
  const [cardTxs,       setCardTxs]       = useState<CardTransaction[]>([]);
  const [monthlyIncomes,setMonthlyIncomes]= useState<MonthlyIncome[]>([]);
  const [categories,    setCategories]    = useState<Category[]>([]);

  // Modals
  const [incomeModal, setIncomeModal] = useState(false);
  const [billModal,   setBillModal]   = useState(false);
  const [cardModal,   setCardModal]   = useState(false);
  const [txModal,     setTxModal]     = useState(false);
  const [catModal,    setCatModal]    = useState(false);
  const [editIncome, setEditIncome] = useState<Partial<IncomeSource>>({});
  const [editBill,   setEditBill]   = useState<Partial<FixedBill>>({});
  const [editCard,   setEditCard]   = useState<Partial<CreditCardType>>({});
  const [editTx,     setEditTx]     = useState<Partial<CardTransaction>>({});
  const [editCat,    setEditCat]    = useState<Partial<Category>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadAll(); }, [month, year]);

  async function loadAll() {
    const [srcs, bills, cats, cards, txs, incomes] = await Promise.all([
      getIncomeSources(month, year),
      getFixedBills(),
      getCategories(),
      getCreditCards(),
      getCardTransactions(month, year),
      getMonthlyIncomes(month, year),
    ]);
    setIncomeSources(srcs);
    setFixedBills(bills);
    setCategories(cats);
    setCreditCards(cards);
    setCardTxs(txs);
    setMonthlyIncomes(incomes);
  }

  // ── Categories ───────────────────────────────────────────────────────────────
  async function saveCat() {
    if (!editCat.name) return;
    setLoading(true);
    await upsertCategory({ color: "#6366f1", active: true, ...editCat });
    setCatModal(false); setEditCat({});
    await loadAll(); setLoading(false);
  }

  async function removeCat(id: string) {
    if (!confirm("Remover esta categoria? As contas mantêm o nome.")) return;
    await deleteCategory(id);
    await loadAll();
  }

  // ── Income ──────────────────────────────────────────────────────────────────
  async function saveIncome() {
    if (!editIncome.name || !editIncome.base_amount) return;
    setLoading(true);
    const isRecurring = editIncome.is_recurring !== false;
    await upsertIncomeSource({
      owner: "casal", type: "salary", active: true,
      is_recurring: true,
      one_time_month: null, one_time_year: null,
      ...editIncome,
      // Se avulsa, garante os campos corretos
      ...(isRecurring ? {} : {
        is_recurring: false,
        one_time_month: editIncome.one_time_month ?? month,
        one_time_year:  editIncome.one_time_year  ?? year,
      }),
    });
    setIncomeModal(false); setEditIncome({});
    await loadAll(); setLoading(false);
  }

  async function removeIncome(id: string) {
    if (!confirm("Remover esta fonte de renda?")) return;
    await deleteIncomeSource(id);
    await loadAll();
  }

  async function toggleIncome(src: IncomeSource, received: boolean) {
    const mi = monthlyIncomes.find(m => m.source_id === src.id);
    await toggleIncomeReceived(src.id, month, year, received, mi?.amount ?? src.base_amount);
    await loadAll();
  }

  // ── Bills ────────────────────────────────────────────────────────────────────
  async function saveBill() {
    if (!editBill.name || !editBill.amount) return;
    setLoading(true);

    let billData: Partial<FixedBill> = { category: "essencial", active: true, ...editBill };

    // Se parcela atual foi informada, calcula start month/year automaticamente
    // (baseado no mês selecionado na página: "mês atual = parcela X")
    if (billData.installment_total && billData.installment_current) {
      const monthIdx  = year * 12 + month - 1;
      const startIdx  = monthIdx - (billData.installment_current - 1);
      billData.installment_start_month = (startIdx % 12) + 1;
      billData.installment_start_year  = Math.floor(startIdx / 12);
    }

    await upsertFixedBill(billData);
    setBillModal(false); setEditBill({});
    await loadAll(); setLoading(false);
  }

  async function removeBill(id: string) {
    if (!confirm("Remover esta conta?")) return;
    await deleteFixedBill(id);
    await loadAll();
  }

  // ── Cards ────────────────────────────────────────────────────────────────────
  async function saveCard() {
    if (!editCard.name || !editCard.due_day) return;
    setLoading(true);
    await upsertCreditCard({ color: "#6366f1", active: true, ...editCard });
    setCardModal(false); setEditCard({});
    await loadAll(); setLoading(false);
  }

  // ── Card Transactions ────────────────────────────────────────────────────────
  async function saveTx() {
    if (!editTx.card_id || !editTx.description || !editTx.amount) return;
    setLoading(true);

    const totalInstallments = Math.max(1, editTx.installment_total ?? 1);
    const totalAmount       = Math.abs(Number(editTx.amount));
    const perInstallment    = totalAmount / totalInstallments;

    if (editTx.id) {
      // Edição: atualiza só esta parcela específica
      await upsertCardTransaction({
        ...editTx,
        amount: -(Math.abs(Number(editTx.amount))),
      });
    } else if (totalInstallments === 1) {
      // Compra à vista: cria uma única transação no mês escolhido
      await upsertCardTransaction({
        card_id: editTx.card_id!, description: editTx.description!,
        amount: -totalAmount, installment_current: 1, installment_total: 1,
        month: editTx.month ?? month,
        year:  editTx.year  ?? year,
      });
    } else {
      // Compra parcelada: distribui a partir da parcela inicial no mês escolhido
      const startInst  = Math.max(1, Math.min(editTx.installment_current ?? 1, totalInstallments));
      const startMonth = editTx.month ?? month;
      const startYear  = editTx.year  ?? year;
      const remaining  = totalInstallments - startInst + 1;
      let m = startMonth, y = startYear;
      const parcelas = Array.from({ length: remaining }, (_, i) => {
        const entry = {
          card_id: editTx.card_id!,
          description: editTx.description!,
          amount: -parseFloat(perInstallment.toFixed(2)),
          installment_current: startInst + i,
          installment_total: totalInstallments,
          month: m, year: y,
        };
        m = m === 12 ? 1 : m + 1;
        if (m === 1) y++;
        return entry;
      });
      await insertCardTransactions(parcelas);
    }

    setTxModal(false); setEditTx({});
    await loadAll(); setLoading(false);
  }

  async function removeTx(id: string) {
    if (!confirm("Remover este lançamento?")) return;
    await deleteCardTransaction(id);
    await loadAll();
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "receitas", label: "Receitas", icon: TrendingUp },
    { key: "contas", label: "Contas", icon: FileText },
    { key: "cartoes", label: "Cartões", icon: CreditCard },
  ];

  const cardTxsByCard = creditCards.map(card => ({
    card,
    txs: cardTxs.filter(t => t.card_id === card.id),
    total: cardTxs.filter(t => t.card_id === card.id).reduce((s, t) => s + Math.abs(t.amount), 0),
  })).filter(c => c.txs.length > 0 || true);

  // Agrupamento dinâmico: período × categoria (suporta categorias customizadas)
  const billsByGroup = (() => {
    const groups: { label: string; bills: FixedBill[] }[] = [];
    const periods: [string | null, string][] = [
      ["1-15",  "1ª Quinzena"],
      ["16-30", "2ª Quinzena"],
      [null,    "Sem período"],
    ];
    periods.forEach(([key, periodLabel]) => {
      const periodBills = fixedBills.filter(b => (b.period ?? null) === key);
      const cats = Array.from(new Set(periodBills.map(b => b.category || "outros")));
      cats.forEach(cat => {
        const bills = periodBills.filter(b => (b.category || "outros") === cat);
        if (bills.length > 0) {
          const label = key
            ? `${cat.charAt(0).toUpperCase() + cat.slice(1)} · ${periodLabel}`
            : periodLabel;
          groups.push({ label, bills });
        }
      });
    });
    return groups;
  })();

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <PageHeader title="Lançamentos" subtitle="Gerencie receitas, contas e cartões">
        <MonthSelector month={month} year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 p-1 rounded-xl w-fit transition-colors">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? "bg-primary-600 text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── RECEITAS ── */}
      {tab === "receitas" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Fontes de Renda</h2>
            <button
              onClick={() => { setEditIncome({}); setIncomeModal(true); }}
              className="btn-primary flex items-center gap-1.5"
            >
              <Plus size={14} /> Nova Fonte
            </button>
          </div>

          <div className="card transition-colors">
            {incomeSources.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8">
                Nenhuma fonte cadastrada
              </p>
            ) : (
              <div className="space-y-0">
                {incomeSources.map((src) => {
                  const mi = monthlyIncomes.find(m => m.source_id === src.id);
                  return (
                    <div key={src.id}
                      className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                          <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{src.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {src.due_day ? `Dia ${src.due_day}` : "Sem data fixa"} · {src.owner}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(mi?.amount ?? src.base_amount)}
                        </p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditIncome(src); setIncomeModal(true); }}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                          >
                            <Pencil size={13} className="text-slate-400 dark:text-slate-500" />
                          </button>
                          <button
                            onClick={() => removeIncome(src.id)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Monthly income total */}
          <div className="mt-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-3 flex justify-between items-center transition-colors">
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Receitas</span>
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(incomeSources.reduce((s, src) => {
                const mi = monthlyIncomes.find(m => m.source_id === src.id);
                return s + (mi?.amount ?? src.base_amount);
              }, 0))}
            </span>
          </div>
        </div>
      )}

      {/* ── CONTAS ── */}
      {tab === "contas" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Contas</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditCat({}); setCatModal(true); }}
                className="btn-secondary flex items-center gap-1.5"
                title="Gerenciar categorias"
              >
                <Plus size={14} /> Categoria
              </button>
              <button
                onClick={() => { setEditBill({}); setBillModal(true); }}
                className="btn-primary flex items-center gap-1.5"
              >
                <Plus size={14} /> Nova Conta
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {billsByGroup.map(({ label, bills }) => (
              <div key={label} className="card transition-colors">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                  {label}
                </h3>
                <div className="space-y-0">
                  {bills.map((bill) => (
                    <div key={bill.id}
                      className="flex items-center justify-between py-2.5 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{bill.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {bill.due_day ? `Vence dia ${bill.due_day}` : "Sem vencimento"}
                          {(() => {
                            if (!bill.installment_total) return null;
                            const inst = computeInstallment(bill, month, year);
                            if (inst) return ` · ${inst.current}/${inst.total}x`;
                            if (bill.installment_current) return ` · ${bill.installment_current}/${bill.installment_total}x`;
                            return null;
                          })()}
                          {bill.notes && ` · ${bill.notes}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {formatCurrency(bill.amount)}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          bill.category === "essencial"
                            ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400"
                            : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                        }`}>
                          {bill.category === "essencial" ? "Essencial" : "Outro"}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditBill(bill); setBillModal(true); }}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                          >
                            <Pencil size={13} className="text-slate-400 dark:text-slate-500" />
                          </button>
                          <button
                            onClick={() => removeBill(bill.id)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Subtotal</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {formatCurrency(bills.reduce((s, b) => s + b.amount, 0))}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 rounded-xl p-3 flex justify-between items-center transition-colors">
            <span className="text-sm font-medium text-primary-700 dark:text-primary-400">Total Contas</span>
            <span className="text-lg font-bold text-primary-700 dark:text-primary-400">
              {formatCurrency(fixedBills.reduce((s, b) => s + b.amount, 0))}
            </span>
          </div>
        </div>
      )}

      {/* ── CARTÕES ── */}
      {tab === "cartoes" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Lançamentos nos Cartões</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditCard({}); setCardModal(true); }}
                className="btn-secondary flex items-center gap-1.5"
              >
                <Plus size={14} /> Novo Cartão
              </button>
              <button
                onClick={() => { setEditTx({ month, year }); setTxModal(true); }}
                className="btn-primary flex items-center gap-1.5"
              >
                <Plus size={14} /> Lançar
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {creditCards.map((card) => {
              const txs = cardTxs.filter(t => t.card_id === card.id);
              const total = txs.reduce((s, t) => s + Math.abs(t.amount), 0);
              return (
                <div key={card.id} className="card transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: card.color }} />
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{card.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{card.bank} · Vence dia {card.due_day} · {card.owner}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(total)}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{txs.length} lançamento{txs.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  {txs.length > 0 ? (
                    <div className="space-y-0">
                      {txs.map((tx) => (
                        <div key={tx.id}
                          className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                          <div>
                            <p className="text-sm text-slate-700 dark:text-slate-200">{tx.description}</p>
                            {tx.installment_total > 1 && (
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              {tx.installment_current}/{tx.installment_total}x
                            </p>
                          )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-red-600">
                              -{formatCurrency(Math.abs(tx.amount))}
                            </span>
                            <button
                              onClick={() => { setEditTx({ ...tx, amount: Math.abs(tx.amount) }); setTxModal(true); }}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                              <Pencil size={12} className="text-slate-400 dark:text-slate-500" />
                            </button>
                            <button
                              onClick={() => removeTx(tx.id)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                            >
                              <Trash2 size={12} className="text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 py-2 text-center">
                      Nenhum lançamento neste mês
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL: Nova Receita ── */}
      <Modal open={incomeModal} onClose={() => { setIncomeModal(false); setEditIncome({}); }}
        title={editIncome.id ? "Editar Fonte de Renda" : "Nova Fonte de Renda"}>
        <div className="space-y-3">
          <div>
            <label className="label">Nome</label>
            <input className="input" placeholder="Ex: Salário Heldem dia 15"
              value={editIncome.name ?? ""}
              onChange={e => setEditIncome(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$)</label>
              <input className="input" type="number" step="0.01" placeholder="0,00"
                value={editIncome.base_amount ?? ""}
                onChange={e => setEditIncome(p => ({ ...p, base_amount: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Dia de Recebimento</label>
              <input className="input" type="number" min="1" max="31" placeholder="15"
                value={editIncome.due_day ?? ""}
                onChange={e => setEditIncome(p => ({ ...p, due_day: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Responsável</label>
              <select className="input" value={editIncome.owner ?? "casal"}
                onChange={e => setEditIncome(p => ({ ...p, owner: e.target.value as any }))}>
                <option value="heldem">Heldem</option>
                <option value="vitoria">Vitoria</option>
                <option value="casal">Casal</option>
              </select>
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={editIncome.type ?? "salary"}
                onChange={e => setEditIncome(p => ({ ...p, type: e.target.value as any }))}>
                <option value="salary">Salário</option>
                <option value="extra">Extra</option>
                <option value="other">Outro</option>
              </select>
            </div>
          </div>

          {/* Receita avulsa (somente um mês) */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Somente este mês</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Receita avulsa, não recorrente</p>
            </div>
            <Toggle
              checked={editIncome.is_recurring === false}
              onChange={v => setEditIncome(p => ({
                ...p,
                is_recurring: !v,
                one_time_month: !v ? (p.one_time_month ?? month) : null,
                one_time_year:  !v ? (p.one_time_year  ?? year)  : null,
              }))}
            />
          </div>

          {/* Mês/Ano da receita avulsa */}
          {editIncome.is_recurring === false && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Mês</label>
                <select className="input" value={editIncome.one_time_month ?? month}
                  onChange={e => setEditIncome(p => ({ ...p, one_time_month: Number(e.target.value) }))}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Ano</label>
                <input className="input" type="number" min="2020" max="2035"
                  value={editIncome.one_time_year ?? year}
                  onChange={e => setEditIncome(p => ({ ...p, one_time_year: Number(e.target.value) }))} />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={() => { setIncomeModal(false); setEditIncome({}); }}
              className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveIncome} disabled={loading}
              className="btn-primary flex-1">Salvar</button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Nova Conta ── */}
      <Modal open={billModal} onClose={() => { setBillModal(false); setEditBill({}); }}
        title={editBill.id ? "Editar Conta" : "Nova Conta"}>
        <div className="space-y-3">
          <div>
            <label className="label">Nome da Conta</label>
            <input className="input" placeholder="Ex: Condomínio"
              value={editBill.name ?? ""}
              onChange={e => setEditBill(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$)</label>
              <input className="input" type="number" step="0.01" placeholder="0,00"
                value={editBill.amount ?? ""}
                onChange={e => setEditBill(p => ({ ...p, amount: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Dia de Vencimento</label>
              <input className="input" type="number" min="1" max="31" placeholder="10"
                value={editBill.due_day ?? ""}
                onChange={e => setEditBill(p => ({ ...p, due_day: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Categoria customizável */}
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={editBill.category ?? "essencial"}
                onChange={e => setEditBill(p => ({ ...p, category: e.target.value }))}>
                {categories.length === 0
                  ? <><option value="essencial">Essencial</option><option value="outros">Outros</option></>
                  : categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                }
              </select>
            </div>
            <div>
              <label className="label">Período</label>
              <select className="input" value={editBill.period ?? ""}
                onChange={e => setEditBill(p => ({ ...p, period: e.target.value as any || null }))}>
                <option value="">Sem período</option>
                <option value="1-15">1ª Quinzena</option>
                <option value="16-30">2ª Quinzena</option>
              </select>
            </div>
          </div>

          {/* Parcelas: total + parcela atual do mês selecionado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Total de Parcelas</label>
              <input className="input" type="number" min="1" placeholder="Sem parcelas"
                value={editBill.installment_total ?? ""}
                onChange={e => setEditBill(p => ({ ...p, installment_total: Number(e.target.value) || null, installment_current: null }))} />
            </div>
            <div>
              <label className="label">Parcela atual</label>
              <input className="input" type="number" min="1"
                max={editBill.installment_total ?? undefined}
                placeholder="Ex: 3"
                disabled={!editBill.installment_total}
                value={editBill.installment_current ?? ""}
                onChange={e => setEditBill(p => ({ ...p, installment_current: Number(e.target.value) || null }))} />
            </div>
          </div>

          {/* Obs separado */}
          <div>
            <label className="label">Obs</label>
            <input className="input" placeholder="Notas"
              value={editBill.notes ?? ""}
              onChange={e => setEditBill(p => ({ ...p, notes: e.target.value }))} />
          </div>

          {/* Preview auto-calculado das parcelas */}
          {(editBill.installment_total ?? 0) > 0 && (editBill.installment_current ?? 0) > 0 && (() => {
            const n   = editBill.installment_total!;
            const cur = editBill.installment_current!;
            const monthIdx = year * 12 + month - 1;
            const startIdx = monthIdx - (cur - 1);
            const sm  = (startIdx % 12) + 1;
            const sy  = Math.floor(startIdx / 12);
            const end = installmentEndDate(sm, sy, n);
            const remaining = n - cur + 1;
            return (
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2 space-y-0.5">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Parcela {cur}/{n} · {formatCurrency((editBill.amount ?? 0) / n)}/mês · falta {remaining}x
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Início: {MONTHS[sm - 1]}/{sy} · Término: {MONTHS[end.month - 1]}/{end.year}
                </p>
              </div>
            );
          })()}

          <div className="flex gap-2 pt-2">
            <button onClick={() => { setBillModal(false); setEditBill({}); }}
              className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveBill} disabled={loading}
              className="btn-primary flex-1">Salvar</button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Nova Categoria ── */}
      <Modal open={catModal} onClose={() => { setCatModal(false); setEditCat({}); }}
        title={editCat.id ? "Editar Categoria" : "Nova Categoria"} size="sm">
        <div className="space-y-3">
          <div>
            <label className="label">Nome</label>
            <input className="input" placeholder="Ex: Lazer, Saúde…"
              value={editCat.name ?? ""}
              onChange={e => setEditCat(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Cor</label>
            <div className="flex items-center gap-3">
              <input className="h-10 w-16 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer"
                type="color" value={editCat.color ?? "#6366f1"}
                onChange={e => setEditCat(p => ({ ...p, color: e.target.value }))} />
              <div className="flex-1 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: editCat.color ?? "#6366f1" }} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {editCat.name || "Prévia"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setCatModal(false); setEditCat({}); }}
              className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveCat} disabled={loading}
              className="btn-primary flex-1">Salvar</button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Novo Cartão ── */}
      <Modal open={cardModal} onClose={() => { setCardModal(false); setEditCard({}); }}
        title={editCard.id ? "Editar Cartão" : "Novo Cartão de Crédito"}>
        <div className="space-y-3">
          <div>
            <label className="label">Nome do Cartão</label>
            <input className="input" placeholder="Ex: NUBANK HELDEM"
              value={editCard.name ?? ""}
              onChange={e => setEditCard(p => ({ ...p, name: e.target.value }))} />
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
              <select className="input" value={editCard.owner ?? "heldem"}
                onChange={e => setEditCard(p => ({ ...p, owner: e.target.value as any }))}>
                <option value="heldem">Heldem</option>
                <option value="vitoria">Vitoria</option>
              </select>
            </div>
            <div>
              <label className="label">Cor</label>
              <input className="input" type="color"
                value={editCard.color ?? "#6366f1"}
                onChange={e => setEditCard(p => ({ ...p, color: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setCardModal(false); setEditCard({}); }}
              className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveCard} disabled={loading}
              className="btn-primary flex-1">Salvar</button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Lançamento Cartão ── */}
      <Modal open={txModal} onClose={() => { setTxModal(false); setEditTx({}); }}
        title={editTx.id ? "Editar Lançamento" : "Novo Lançamento no Cartão"}>
        <div className="space-y-3">

          {/* Cartão — só mostra para novo lançamento */}
          {!editTx.id && (
            <div>
              <label className="label">Cartão</label>
              <select className="input" value={editTx.card_id ?? ""}
                onChange={e => setEditTx(p => ({ ...p, card_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {creditCards.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="label">Descrição</label>
            <input className="input" placeholder="Ex: Supermercado Assaí"
              value={editTx.description ?? ""}
              onChange={e => setEditTx(p => ({ ...p, description: e.target.value }))} />
          </div>

          {/* Valor + Parcelas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">
                {editTx.id ? "Valor da Parcela (R$)" : "Valor Total (R$)"}
              </label>
              <input className="input" type="number" step="0.01" placeholder="0,00"
                value={editTx.amount ?? ""}
                onChange={e => setEditTx(p => ({ ...p, amount: Number(e.target.value) }))} />
            </div>
            {/* Parcelas — só para novo */}
            {!editTx.id && (
              <div>
                <label className="label">Total de Parcelas</label>
                <input className="input" type="number" min="1" max="360" placeholder="1"
                  value={editTx.installment_total ?? 1}
                  onChange={e => setEditTx(p => ({ ...p, installment_total: Number(e.target.value) || 1 }))} />
              </div>
            )}
          </div>

          {/* Parcela inicial — só quando parcelado e novo */}
          {!editTx.id && (editTx.installment_total ?? 1) > 1 && (
            <div>
              <label className="label">Parcela atual (qual é este mês?)</label>
              <input className="input" type="number" min="1" max={editTx.installment_total ?? 1}
                placeholder="1"
                value={editTx.installment_current ?? 1}
                onChange={e => setEditTx(p => ({ ...p, installment_current: Number(e.target.value) || 1 }))} />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Preencha se a compra já começou em meses anteriores (ex: compra de 12x, hoje é a 3ª parcela)
              </p>
            </div>
          )}

          {/* Mês/Ano de início — sempre para novo lançamento */}
          {!editTx.id && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Mês início</label>
                <select className="input" value={editTx.month ?? month}
                  onChange={e => setEditTx(p => ({ ...p, month: Number(e.target.value) }))}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Ano início</label>
                <input className="input" type="number" min="2020" max="2035"
                  value={editTx.year ?? year}
                  onChange={e => setEditTx(p => ({ ...p, year: Number(e.target.value) }))} />
              </div>
            </div>
          )}

          {/* Preview de parcelamento (novo lançamento com > 1 parcela) */}
          {!editTx.id && (editTx.installment_total ?? 1) > 1 && Number(editTx.amount) > 0 && (() => {
            const n         = editTx.installment_total!;
            const startInst = Math.max(1, Math.min(editTx.installment_current ?? 1, n));
            const startM    = editTx.month ?? month;
            const startY    = editTx.year  ?? year;
            const valor     = Number(editTx.amount) / n;
            const remaining = n - startInst + 1;
            const totalIdx  = (startY * 12 + startM - 1) + (remaining - 1);
            const endMonth  = (totalIdx % 12) + 1;
            const endYear   = Math.floor(totalIdx / 12);
            return (
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 rounded-lg p-3 text-xs space-y-0.5">
                <p className="font-medium text-primary-700 dark:text-primary-400">
                  {formatCurrency(valor)}/parcela × {remaining} {remaining !== n ? `meses restantes (de ${n}x)` : "meses"}
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  De {MONTHS[startM - 1]}/{startY} ({startInst}/{n}) até {MONTHS[endMonth - 1]}/{endYear} ({n}/{n})
                </p>
              </div>
            );
          })()}

          {/* Info de parcela no modo edição */}
          {editTx.id && (editTx.installment_total ?? 1) > 1 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
              Parcela {editTx.installment_current}/{editTx.installment_total} — apenas este mês será alterado
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={() => { setTxModal(false); setEditTx({}); }}
              className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveTx} disabled={loading}
              className="btn-primary flex-1">Salvar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
