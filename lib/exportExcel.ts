import * as XLSX from "xlsx";
import type { Category, FixedBill, IncomeSource } from "@/types";
import { formatCurrency, computeInstallment } from "@/lib/utils";
import { MONTHS } from "@/types";
import {
  getCardTransactionsByYear,
  getFixedBills,
  getIncomeSources,
  getMonthlyBillPayments,
  getMonthlyIncomes,
  getCreditCards,
} from "@/lib/queries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currency(v: number) {
  return parseFloat(v.toFixed(2));
}

function monthLabel(m: number) {
  return MONTHS[m - 1];
}

// ─── Export principal ─────────────────────────────────────────────────────────

export async function exportFinanceiro(
  year: number,
  currentMonth: number,
  preloaded: {
    categories: Category[];
    fixedBills: FixedBill[];
    annualCardByCat: Record<number, Record<string, number>>;
    allCatKeys: string[];
    incomeTotal: number;
    totalExpenses: number;
    prevBalance: number;
    incomeSources: IncomeSource[];
  }
) {
  const wb = XLSX.utils.book_new();

  // ── Carrega dados que ainda não temos ─────────────────────────────────────
  const [cards, annualTxs] = await Promise.all([
    getCreditCards(),
    getCardTransactionsByYear(year),
  ]);

  // Carrega incomes e bill payments para todos os 12 meses
  const [allMonthlyIncomes, allBillPayments] = await Promise.all([
    Promise.all(Array.from({ length: 12 }, (_, i) => getMonthlyIncomes(i + 1, year))),
    Promise.all(Array.from({ length: 12 }, (_, i) => getMonthlyBillPayments(i + 1, year))),
  ]);

  const { categories, fixedBills, annualCardByCat, allCatKeys, incomeSources } = preloaded;

  // ─── Aba 1: Resumo Anual ──────────────────────────────────────────────────
  {
    const headers = ["Mês", "Receitas", ...allCatKeys.map(k => k.charAt(0).toUpperCase() + k.slice(1)), "Total Despesas", "Saldo", "Saldo Acum."];
    const rows: any[][] = [headers];

    let acc = 0;
    for (let m = 1; m <= 12; m++) {
      const monthIncs = allMonthlyIncomes[m - 1];
      const monthBillPays = allBillPayments[m - 1];

      // Receita do mês
      const receitas = incomeSources.reduce((s, src) => {
        const mi = monthIncs.find(i => i.source_id === src.id);
        if (src.is_recurring === false) {
          if (src.one_time_month !== m || src.one_time_year !== year) return s;
        }
        return s + (mi?.amount ?? src.base_amount);
      }, 0);

      // Gastos por categoria
      const catAmounts: Record<string, number> = {};
      allCatKeys.forEach(cat => {
        // Contas fixas
        const billAmt = fixedBills.filter(b => {
          if ((b.category || "outros") !== cat) return false;
          if (!b.installment_total) return true;
          if (b.installment_start_month == null || b.installment_start_year == null) return true;
          return computeInstallment(b, m, year) !== null;
        }).reduce((s, b) => {
          const p = monthBillPays.find(p => p.bill_id === b.id);
          return s + (p?.amount ?? b.amount);
        }, 0);
        // Cartão
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

    // Totais
    const totals: any[] = ["TOTAL"];
    for (let c = 1; c < headers.length - 1; c++) {
      totals.push(rows.slice(1).reduce((s: number, r: any[]) => s + (Number(r[c]) || 0), 0));
    }
    totals.push(rows[rows.length - 1][rows[0].length - 1]); // último saldo acumulado
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

    // Total por mês
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

  // ─── Download ─────────────────────────────────────────────────────────────
  XLSX.writeFile(wb, `financeiro-${year}.xlsx`);
}
