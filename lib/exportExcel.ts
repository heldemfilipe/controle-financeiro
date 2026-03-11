import * as XLSX from "xlsx";
import type { FixedBill } from "@/types";
import { computeInstallment } from "@/lib/utils";
import { MONTHS } from "@/types";
import {
  getCardTransactionsByYear,
  getFixedBills,
  getIncomeSources,
  getMonthlyBillPayments,
  getMonthlyIncomes,
  getCreditCards,
  getCardTransactions,
  getMonthlyCardPayments,
} from "@/lib/queries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currency(v: number) {
  return parseFloat(v.toFixed(2));
}

function monthLabel(m: number) {
  return MONTHS[m - 1];
}

// ─── Export Anual ─────────────────────────────────────────────────────────────

export async function exportFinanceiro(year: number) {
  const wb = XLSX.utils.book_new();

  // ── Carrega todos os dados ─────────────────────────────────────────────────
  const [fixedBills, incomeSources, cards, annualTxs] = await Promise.all([
    getFixedBills(),
    getIncomeSources(),
    getCreditCards(),
    getCardTransactionsByYear(year),
  ]);

  const [allMonthlyIncomes, allBillPayments] = await Promise.all([
    Promise.all(Array.from({ length: 12 }, (_, i) => getMonthlyIncomes(i + 1, year))),
    Promise.all(Array.from({ length: 12 }, (_, i) => getMonthlyBillPayments(i + 1, year))),
  ]);

  // Categorias de contas fixas + cartão
  const billCatKeys = Array.from(new Set(fixedBills.filter(b => !b.is_tithe).map(b => b.category || "outros")));
  const cardCatKeys = Array.from(new Set(annualTxs.map(t => t.category ?? "Sem categoria")));
  const allCatKeys  = Array.from(new Set([...billCatKeys, ...cardCatKeys]));

  // Transações de cartão por mês → categoria
  const annualCardByCat: Record<number, Record<string, number>> = {};
  for (let m = 1; m <= 12; m++) annualCardByCat[m] = {};
  annualTxs.forEach(tx => {
    const m   = tx.month;
    const key = tx.category ?? "Sem categoria";
    annualCardByCat[m][key] = (annualCardByCat[m][key] ?? 0) - tx.amount;
    if (annualCardByCat[m][key] <= 0) delete annualCardByCat[m][key];
  });

  // ─── Aba 1: Resumo Anual ──────────────────────────────────────────────────
  {
    const headers = ["Mês", "Receitas", ...allCatKeys.map(k => k.charAt(0).toUpperCase() + k.slice(1)), "Total Despesas", "Saldo", "Saldo Acum."];
    const rows: any[][] = [headers];

    let acc = 0;
    for (let m = 1; m <= 12; m++) {
      const monthIncs    = allMonthlyIncomes[m - 1];
      const monthBillPays = allBillPayments[m - 1];

      const sourcesM = incomeSources.filter(s =>
        s.is_recurring !== false ||
        (s.one_time_month === m && s.one_time_year === year)
      );
      const receitas = sourcesM.reduce((s, src) => {
        const mi = monthIncs.find(i => i.source_id === src.id);
        return s + (mi?.amount ?? src.base_amount);
      }, 0);

      const catAmounts: Record<string, number> = {};
      allCatKeys.forEach(cat => {
        const billAmt = fixedBills.filter(b => {
          if ((b.category || "outros") !== cat) return false;
          if (!b.installment_total) return true;
          if (b.installment_start_month == null || b.installment_start_year == null) return true;
          return computeInstallment(b, m, year) !== null;
        }).reduce((s, b) => {
          const p = monthBillPays.find(p => p.bill_id === b.id);
          return s + (p?.amount ?? b.amount);
        }, 0);
        const cardAmt = annualCardByCat[m]?.[cat] ?? 0;
        catAmounts[cat] = billAmt + cardAmt;
      });

      const totalDesp = Object.values(catAmounts).reduce((s, v) => s + v, 0);
      const saldo = receitas - totalDesp;
      acc += saldo;

      rows.push([
        monthLabel(m),
        currency(receitas),
        ...allCatKeys.map(k => currency(catAmounts[k] ?? 0)),
        currency(totalDesp),
        currency(saldo),
        currency(acc),
      ]);
    }

    const totals: any[] = ["TOTAL"];
    for (let c = 1; c < headers.length - 1; c++) {
      totals.push(rows.slice(1).reduce((s: number, r: any[]) => s + (Number(r[c]) || 0), 0));
    }
    totals.push(rows[rows.length - 1][rows[0].length - 1]);
    rows.push(totals);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, ...headers.slice(1).map(() => ({ wch: 15 }))];
    XLSX.utils.book_append_sheet(wb, ws, "Resumo Anual");
  }

  // ─── Aba 2: Lançamentos Cartão ────────────────────────────────────────────
  {
    const headers = ["Mês", "Cartão", "Descrição", "Categoria", "Valor (R$)", "Tipo", "Parcela", "Total Parcelas"];
    const rows: any[][] = [headers];

    annualTxs.forEach(tx => {
      const card = cards.find(c => c.id === tx.card_id);
      rows.push([
        monthLabel(tx.month),
        card?.name ?? tx.card_id,
        tx.description,
        tx.category ?? "Sem categoria",
        currency(Math.abs(tx.amount)),
        tx.amount < 0 ? "Despesa" : "Crédito",
        tx.installment_current ?? 1,
        tx.installment_total ?? 1,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, "Lançamentos Cartão");
  }

  // ─── Aba 3: Contas Fixas ──────────────────────────────────────────────────
  {
    const headers = ["Nome", "Categoria", "Valor (R$)", "Vencimento", "Quinzena", "Parcelas", "Observação"];
    const rows: any[][] = [headers];

    fixedBills.forEach(b => {
      const instInfo = b.installment_total
        ? `${b.installment_current ?? "?"}/${b.installment_total}x`
        : "Recorrente";
      rows.push([
        b.name,
        b.category ?? "outros",
        currency(b.amount),
        b.due_day ? `Dia ${b.due_day}` : "—",
        b.period ?? "—",
        instInfo,
        b.notes ?? "",
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Contas Fixas");
  }

  // ─── Aba 4: Receitas Mensais ──────────────────────────────────────────────
  {
    const headers = ["Fonte", "Titular", "Tipo", ...MONTHS, "Média"];
    const rows: any[][] = [headers];

    incomeSources.forEach(src => {
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        if (src.is_recurring === false) {
          if (src.one_time_month !== m || src.one_time_year !== year) return 0;
        }
        const mi = allMonthlyIncomes[i].find(inc => inc.source_id === src.id);
        return currency(mi?.amount ?? src.base_amount);
      });
      const avg = monthly.reduce((s, v) => s + v, 0) / 12;
      rows.push([src.name, src.owner, src.type, ...monthly, currency(avg)]);
    });

    const totals: any[] = ["TOTAL", "", ""];
    for (let m = 0; m < 12; m++) {
      totals.push(rows.slice(1).reduce((s: number, r: any[]) => s + (Number(r[3 + m]) || 0), 0));
    }
    totals.push(rows.slice(1).reduce((s: number, r: any[]) => s + (Number(r[r.length - 1]) || 0), 0));
    rows.push(totals);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 10 }, ...MONTHS.map(() => ({ wch: 13 })), { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Receitas");
  }

  // ─── Aba 5: Resumo por Cartão ─────────────────────────────────────────────
  {
    const headers = ["Cartão", "Titular", "Venc.", ...MONTHS, "Total Ano"];
    const rows: any[][] = [headers];

    cards.forEach(card => {
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const monthTxs = annualTxs.filter(t => t.card_id === card.id && t.month === m);
        return currency(monthTxs.reduce((s, t) => s - t.amount, 0));
      });
      const total = monthly.reduce((s, v) => s + v, 0);
      rows.push([card.name, card.owner, `Dia ${card.due_day}`, ...monthly, currency(total)]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 8 }, ...MONTHS.map(() => ({ wch: 13 })), { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Cartões");
  }

  XLSX.writeFile(wb, `financeiro-${year}.xlsx`);
}

// ─── Export Mensal ────────────────────────────────────────────────────────────

export async function exportMonth(month: number, year: number) {
  const wb = XLSX.utils.book_new();
  const monthName = MONTHS[month - 1];

  const [bills, incomeSources, cards, txs, billPays, incomes] = await Promise.all([
    getFixedBills(),
    getIncomeSources(month, year),
    getCreditCards(),
    getCardTransactions(month, year),
    getMonthlyBillPayments(month, year),
    getMonthlyIncomes(month, year),
  ]);

  // Valor efetivo de cada conta no mês
  function billAmt(b: FixedBill): number {
    const p = billPays.find(p => p.bill_id === b.id);
    return p?.amount ?? b.amount;
  }

  // ─── Aba 1: Fluxo do Mês ─────────────────────────────────────────────────
  {
    const rows: any[][] = [["Fluxo de Caixa — " + monthName + "/" + year]];
    rows.push([]);

    // Receitas
    rows.push(["RECEITAS"]);
    rows.push(["Fonte", "Titular", "Valor (R$)"]);
    const totalIncome = incomeSources.reduce((s, src) => {
      const mi = incomes.find(i => i.source_id === src.id);
      return s + (mi?.amount ?? src.base_amount);
    }, 0);
    incomeSources.forEach(src => {
      const mi  = incomes.find(i => i.source_id === src.id);
      const amt = mi?.amount ?? src.base_amount;
      rows.push([src.name, src.owner, currency(amt)]);
    });
    rows.push(["Total receitas", "", currency(totalIncome)]);
    rows.push([]);

    // 1ª Quinzena
    const q1Bills    = bills.filter(b => !b.is_tithe && b.period === "1-15");
    const q1Cards    = cards.filter(c => c.due_day <= 15);
    const q1BillsSum = q1Bills.reduce((s, b) => s + billAmt(b), 0);
    const q1CardsSum = q1Cards.reduce((s, c) => s + txs.filter(t => t.card_id === c.id).reduce((a, t) => a - t.amount, 0), 0);

    rows.push(["1ª QUINZENA (dias 1–15)"]);
    rows.push(["Tipo", "Nome", "Valor (R$)"]);
    q1Bills.forEach(b => rows.push(["Conta", b.name, currency(billAmt(b))]));
    q1Cards.forEach(c => {
      const total = txs.filter(t => t.card_id === c.id).reduce((s, t) => s - t.amount, 0);
      if (total > 0) rows.push(["Cartão", c.name, currency(total)]);
    });
    rows.push(["Total 1ª quinzena", "", currency(q1BillsSum + q1CardsSum)]);
    rows.push([]);

    // 2ª Quinzena
    const q2Bills    = bills.filter(b => !b.is_tithe && b.period === "16-30");
    const q2Cards    = cards.filter(c => c.due_day > 15);
    const q2BillsSum = q2Bills.reduce((s, b) => s + billAmt(b), 0);
    const q2CardsSum = q2Cards.reduce((s, c) => s + txs.filter(t => t.card_id === c.id).reduce((a, t) => a - t.amount, 0), 0);
    const titheBill  = bills.find(b => b.is_tithe);
    const titheAmt   = titheBill ? (billPays.find(p => p.bill_id === titheBill.id)?.amount ?? titheBill.amount) : 0;

    rows.push(["2ª QUINZENA (dias 16–30)"]);
    rows.push(["Tipo", "Nome", "Valor (R$)"]);
    q2Bills.forEach(b => rows.push(["Conta", b.name, currency(billAmt(b))]));
    q2Cards.forEach(c => {
      const total = txs.filter(t => t.card_id === c.id).reduce((s, t) => s - t.amount, 0);
      if (total > 0) rows.push(["Cartão", c.name, currency(total)]);
    });
    if (titheBill && titheAmt > 0) rows.push(["Dízimo", titheBill.name, currency(titheAmt)]);
    rows.push(["Total 2ª quinzena", "", currency(q2BillsSum + q2CardsSum + titheAmt)]);
    rows.push([]);

    const totalDesp = q1BillsSum + q1CardsSum + q2BillsSum + q2CardsSum + titheAmt;
    rows.push(["SALDO DO MÊS", "", currency(totalIncome - totalDesp)]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, "Fluxo do Mês");
  }

  // ─── Aba 2: Contas do Mês ─────────────────────────────────────────────────
  {
    const headers = ["Nome", "Categoria", "Quinzena", "Vencimento", "Valor (R$)", "Pago", "Parcela"];
    const rows: any[][] = [headers];

    bills.filter(b => !b.is_tithe).forEach(b => {
      const p    = billPays.find(p => p.bill_id === b.id);
      const inst = computeInstallment(b, month, year);
      rows.push([
        b.name,
        b.category ?? "outros",
        b.period ?? "—",
        b.due_day ? `Dia ${b.due_day}` : "—",
        currency(billAmt(b)),
        p?.paid ? "Sim" : "Não",
        inst ? `${inst.current}/${inst.total}x` : "Recorrente",
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Contas do Mês");
  }

  // ─── Aba 3: Cartões do Mês ────────────────────────────────────────────────
  {
    const headers = ["Cartão", "Descrição", "Categoria", "Valor (R$)", "Tipo", "Parcela"];
    const rows: any[][] = [headers];

    txs.forEach(tx => {
      const card = cards.find(c => c.id === tx.card_id);
      rows.push([
        card?.name ?? tx.card_id,
        tx.description,
        tx.category ?? "Sem categoria",
        currency(Math.abs(tx.amount)),
        tx.amount < 0 ? "Despesa" : "Crédito",
        tx.installment_total > 1 ? `${tx.installment_current}/${tx.installment_total}x` : "—",
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, "Cartões do Mês");
  }

  XLSX.writeFile(wb, `financeiro-${monthName}-${year}.xlsx`);
}
