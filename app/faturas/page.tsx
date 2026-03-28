"use client";

import { useEffect, useState } from "react";
import { CreditCard, Plus, Trash2, TrendingDown, AlertTriangle, Pencil } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  getCreditCards, getCardTransactionsByCard, getCardTransactions,
  getMonthlyCardPayments, toggleCardPaid,
  upsertCardTransaction, deleteCardTransaction,
} from "@/lib/queries";
import { formatCurrency, getCurrentMonth, isOverdue } from "@/lib/utils";
import { MONTH_SHORT } from "@/types";
import type { CreditCard as CreditCardType, CardTransaction, MonthlyCardPayment } from "@/types";

export default function FaturasPage() {
  const { month: cm, year: cy } = getCurrentMonth();
  const [month, setMonth] = useState(cm);
  const [year, setYear] = useState(cy);

  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [selectedCard, setSelectedCard] = useState<CreditCardType | null>(null);
  const [txs, setTxs] = useState<CardTransaction[]>([]);
  const [cardPayments, setCardPayments] = useState<MonthlyCardPayment[]>([]);
  const [yearlyData, setYearlyData] = useState<any[]>([]);
  const [allTxsThisMonth, setAllTxsThisMonth] = useState<CardTransaction[]>([]);

  const [txModal, setTxModal] = useState(false);
  const [editTx, setEditTx] = useState<Partial<CardTransaction>>({});
  const [loading, setLoading] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => { loadCards(); }, []);
  useEffect(() => { if (cards.length > 0) loadMonthData(); }, [month, year, cards, selectedCard]);

  async function loadCards() {
    const cs = await getCreditCards();
    setCards(cs);
    if (cs.length > 0) setSelectedCard(cs[0]);
  }

  async function loadMonthData() {
    const [payments, allTxs] = await Promise.all([
      getMonthlyCardPayments(month, year),
      getCardTransactions(month, year),
    ]);
    setCardPayments(payments);
    setAllTxsThisMonth(allTxs);

    if (selectedCard) {
      const cardTxs = await getCardTransactionsByCard(selectedCard.id, month, year);
      setTxs(cardTxs);

      const yd = await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
          const m = i + 1;
          const mt = await getCardTransactionsByCard(selectedCard.id, m, year);
          return {
            name: MONTH_SHORT[i],
            total: mt.reduce((s, t) => s + Math.abs(t.amount), 0),
          };
        })
      );
      setYearlyData(yd);
    }
  }

  async function handleToggleCard(card: CreditCardType, paid: boolean) {
    const total = allTxsThisMonth
      .filter(t => t.card_id === card.id)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    await toggleCardPaid(card.id, month, year, paid, total);
    await loadMonthData();
  }

  async function saveTx() {
    if (!editTx.description || !editTx.amount || !selectedCard) return;
    setLoading(true);
    try {
      await upsertCardTransaction({
        installment_current: 1, installment_total: 1,
        card_id: selectedCard.id,
        month, year,
        ...editTx,
        amount: -(Math.abs(Number(editTx.amount))),
      });
      setTxModal(false); setEditTx({});
      toast(editTx.id ? "Lancamento atualizado" : "Lancamento adicionado");
      await loadMonthData();
    } catch { toast("Erro ao salvar lancamento", "error"); }
    setLoading(false);
  }

  async function saveInlineEdit(tx: CardTransaction, newAmount: number, newDesc: string) {
    try {
      await upsertCardTransaction({ ...tx, amount: -Math.abs(newAmount), description: newDesc });
      setEditingTxId(null);
      toast("Lancamento atualizado");
      await loadMonthData();
    } catch { toast("Erro ao atualizar", "error"); }
  }

  async function removeTx(id: string) {
    if (!confirm("Remover este lancamento?")) return;
    await deleteCardTransaction(id);
    toast("Lancamento removido");
    await loadMonthData();
  }

  const selectedPayment = selectedCard
    ? cardPayments.find(p => p.card_id === selectedCard.id)
    : null;

  const selectedTotal = selectedCard
    ? allTxsThisMonth.filter(t => t.card_id === selectedCard.id).reduce((s, t) => s + Math.abs(t.amount), 0)
    : 0;

  const getCardTotal = (cardId: string) =>
    allTxsThisMonth.filter(t => t.card_id === cardId).reduce((s, t) => s + Math.abs(t.amount), 0);

  const getCardStatus = (card: CreditCardType) => {
    const p = cardPayments.find(p => p.card_id === card.id);
    const total = getCardTotal(card.id);
    if (p?.paid) return "paid";
    if (total > 0 && isOverdue(card.due_day, month, year)) return "overdue";
    return "pending";
  };

  const grandTotal = allTxsThisMonth.reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <PageHeader title="Faturas" subtitle="Detalhamento das faturas dos cartões">
        <MonthSelector month={month} year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </PageHeader>

      {/* Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
        {cards.map((card) => {
          const total = getCardTotal(card.id);
          const status = getCardStatus(card);
          const payment = cardPayments.find(p => p.card_id === card.id);
          const isSelected = selectedCard?.id === card.id;

          return (
            <button
              key={card.id}
              onClick={() => setSelectedCard(card)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? "shadow-md"
                  : "border-transparent bg-white dark:bg-slate-800 shadow-sm hover:shadow-md"
              }`}
              style={isSelected ? { borderColor: card.color } : {}}
            >
              <div
                className="h-16 rounded-lg mb-3 p-3 flex items-end justify-between"
                style={{ background: `linear-gradient(135deg, ${card.color}cc, ${card.color})` }}
              >
                <div>
                  <p className="text-white font-bold text-xs">{card.name}</p>
                  <p className="text-white/70 text-xs">{card.bank}</p>
                </div>
                <CreditCard size={20} className="text-white/80" />
              </div>

              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Dia {card.due_day} · {card.owner}
                </span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                  status === "paid"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    : status === "overdue" && total > 0
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}>
                  {status === "paid" ? "Pago" : status === "overdue" && total > 0 ? "Vencida" : "Aberto"}
                </span>
              </div>

              <p className={`text-lg font-bold ${
                total > 0
                  ? "text-slate-800 dark:text-slate-100"
                  : "text-slate-300 dark:text-slate-600"
              }`}>
                {formatCurrency(total)}
              </p>

              {payment?.paid && payment.paid_date && (
                <p className="text-xs text-emerald-600 mt-0.5">
                  Pago em {new Date(payment.paid_date + "T00:00:00").toLocaleDateString("pt-BR")}
                </p>
              )}

              {total > 0 && (
                <div className="mt-2 flex items-center justify-between"
                  onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-slate-400 dark:text-slate-500">Marcar como pago</span>
                  <Toggle
                    size="sm"
                    checked={payment?.paid ?? false}
                    onChange={(v) => handleToggleCard(card, v)}
                  />
                </div>
              )}
            </button>
          );
        })}

        {/* Total card */}
        <div className="bg-slate-800 dark:bg-slate-700 rounded-xl p-4 text-white flex flex-col justify-between">
          <div>
            <p className="text-xs text-slate-400 mb-1">Total Geral</p>
            <p className="text-2xl font-bold">{formatCurrency(grandTotal)}</p>
          </div>
          <div className="space-y-1 mt-3">
            {cards.filter(c => getCardTotal(c.id) > 0).slice(0, 3).map(card => (
              <div key={card.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: card.color }} />
                  <span className="text-slate-400 truncate max-w-[100px]">{card.name}</span>
                </div>
                <span className="text-slate-300">{formatCurrency(getCardTotal(card.id))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Card Detail */}
      {selectedCard && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Transactions List */}
          <div className="xl:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: selectedCard.color + "22" }}
                >
                  <CreditCard size={15} style={{ color: selectedCard.color }} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                    {selectedCard.name}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Vence dia {selectedCard.due_day} · {txs.length} lançamento{txs.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-2">
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {formatCurrency(selectedTotal)}
                  </p>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-xs text-slate-400 dark:text-slate-500">Pago</span>
                    <Toggle
                      size="sm"
                      checked={selectedPayment?.paid ?? false}
                      onChange={(v) => handleToggleCard(selectedCard, v)}
                      disabled={selectedTotal === 0}
                    />
                  </div>
                </div>
                <button
                  onClick={() => { setEditTx({}); setTxModal(true); }}
                  className="btn-primary flex items-center gap-1.5"
                >
                  <Plus size={14} /> Lançar
                </button>
              </div>
            </div>

            {txs.length === 0 ? (
              <div className="py-12 text-center">
                <CreditCard size={32} className="text-slate-200 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">Nenhum lançamento neste mês</p>
                <button
                  onClick={() => { setEditTx({}); setTxModal(true); }}
                  className="btn-primary mt-3"
                >
                  Adicionar Lançamento
                </button>
              </div>
            ) : (
              <div>
                {txs.map((tx) => (
                  <div key={tx.id}
                    className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                        <TrendingDown size={13} className="text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {tx.description}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {tx.transaction_date
                            ? new Date(tx.transaction_date + "T00:00:00").toLocaleDateString("pt-BR")
                            : "—"}
                          {tx.installment_total > 1 &&
                            ` · Parcela ${tx.installment_current}/${tx.installment_total}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-red-600">
                        -{formatCurrency(Math.abs(tx.amount))}
                      </span>
                      <button
                        onClick={() => removeTx(tx.id)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100 dark:border-slate-700/50">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Total da Fatura
                  </span>
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {formatCurrency(selectedTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="card">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-4">
              Histórico {year} — {selectedCard.name}
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={yearlyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="total" name="Fatura" radius={[4, 4, 0, 0]}
                  fill={selectedCard.color} />
              </BarChart>
            </ResponsiveContainer>

            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Maior fatura</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatCurrency(Math.max(...yearlyData.map(d => d.total)))}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Menor fatura</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatCurrency(Math.min(...yearlyData.filter(d => d.total > 0).map(d => d.total), 0))}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Média mensal</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatCurrency(yearlyData.reduce((s, d) => s + d.total, 0) / 12)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Total no ano</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {formatCurrency(yearlyData.reduce((s, d) => s + d.total, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal open={txModal} onClose={() => { setTxModal(false); setEditTx({}); }}
        title={`Novo Lançamento — ${selectedCard?.name ?? ""}`}>
        <div className="space-y-3">
          <div>
            <label className="label">Descrição</label>
            <input className="input" placeholder="Ex: Supermercado Assaí"
              value={editTx.description ?? ""}
              onChange={e => setEditTx(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$)</label>
              <input className="input" type="number" step="0.01" placeholder="0,00"
                value={editTx.amount ?? ""}
                onChange={e => setEditTx(p => ({ ...p, amount: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Data da Compra</label>
              <input className="input" type="date"
                value={editTx.transaction_date ?? ""}
                onChange={e => setEditTx(p => ({ ...p, transaction_date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Parcela Atual</label>
              <input className="input" type="number" min="1"
                value={editTx.installment_current ?? 1}
                onChange={e => setEditTx(p => ({ ...p, installment_current: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Total Parcelas</label>
              <input className="input" type="number" min="1"
                value={editTx.installment_total ?? 1}
                onChange={e => setEditTx(p => ({ ...p, installment_total: Number(e.target.value) }))} />
            </div>
          </div>
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
