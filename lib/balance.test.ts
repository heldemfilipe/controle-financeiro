import { beforeEach, describe, expect, it, vi } from "vitest";

const { data, calls } = vi.hoisted(() => ({
  calls: { transactions: 0, bills: 0 },
  data: {
    incomes: [] as any[],
    payments: [] as any[],
    txs: [] as any[],
    bills: [] as any[],
    sources: [] as any[],
    amounts: [] as any[],
    overrides: [] as any[],
    advances: [] as any[],
  },
}));

vi.mock("./queries", () => ({
  getMonthlyIncomesByYear: async (y: number) => data.incomes.filter(r => r.year === y),
  getMonthlyBillPaymentsByYear: async (y: number) => data.payments.filter(r => r.year === y),
  getCardTransactionsByYear: async (y: number) => {
    calls.transactions++;
    return data.txs.filter(r => r.year === y);
  },
  getFixedBills: async () => {
    calls.bills++;
    return data.bills;
  },
  getIncomeSources: async () => data.sources,
  getIncomeSourceAmounts: async () => data.amounts,
  getBalanceOverrides: async (y: number) => data.overrides.filter(o => o.year === y),
  getBillAdvancesMadeInYear: async (y: number) => data.advances.filter(a => a.paid_year === y),
  getBillAdvancesForYear: async (y: number) => data.advances.filter(a => a.target_year === y),
}));

vi.mock("./settings", () => ({
  loadAccConfig: async () => ({ saldoInicial: 0, startMonth: 1, startYear: 2026 }),
}));

import { clearBalanceCache, computeMonthBalance, computePrevBalance, computeYearBalances } from "./balance";

const bill = (patch: Record<string, unknown> = {}) => ({
  id: "b1", name: "Luz", amount: 100, category: "essencial", is_tithe: false,
  start_month: null, start_year: null, stop_month: null, stop_year: null,
  installment_total: null, installment_current: null,
  installment_start_month: null, installment_start_year: null,
  ...patch,
});

const source = (patch: Record<string, unknown> = {}) => ({
  id: "s1", name: "Salário", base_amount: 1000, is_recurring: true,
  one_time_month: null, one_time_year: null,
  start_month: null, start_year: null, stop_month: null, stop_year: null,
  ...patch,
});

const tx = (amount: number, month: number, year = 2026) =>
  ({ id: `${month}${amount}`, card_id: "c1", amount, month, year });

const config = { saldoInicial: 100, startMonth: 1, startYear: 2026 };

beforeEach(() => {
  clearBalanceCache();
  Object.values(data).forEach(list => { list.length = 0; });
  calls.transactions = 0;
  calls.bills = 0;
});

describe("computeMonthBalance", () => {
  it("soma receitas, contas e cartões", async () => {
    data.sources.push(source());
    data.bills.push(bill());
    data.txs.push(tx(-300, 1));

    expect(await computeMonthBalance(1, 2026)).toMatchObject({
      totalIncome: 1000, totalBills: 100, totalCards: 300, balance: 600,
    });
  });

  it("o valor lançado no mês substitui os valores padrão", async () => {
    data.sources.push(source());
    data.bills.push(bill());
    data.incomes.push({ source_id: "s1", amount: 1200, month: 1, year: 2026 });
    data.payments.push({ bill_id: "b1", amount: 80, month: 1, year: 2026 });

    expect(await computeMonthBalance(1, 2026)).toMatchObject({ totalIncome: 1200, totalBills: 80 });
  });

  it("estorno reduz o total dos cartões", async () => {
    data.txs.push(tx(-500, 1), tx(50, 1));
    expect((await computeMonthBalance(1, 2026)).totalCards).toBe(450);
  });

  it("não conta a conta antes do início nem depois do encerramento", async () => {
    data.bills.push(bill({ start_month: 3, start_year: 2026, stop_month: 5, stop_year: 2026 }));

    expect((await computeMonthBalance(2, 2026)).totalBills).toBe(0);
    expect((await computeMonthBalance(3, 2026)).totalBills).toBe(100);
    expect((await computeMonthBalance(4, 2026)).totalBills).toBe(100);
    expect((await computeMonthBalance(5, 2026)).totalBills).toBe(0);
  });

  it("não conta pagamento de conta fora do período", async () => {
    data.bills.push(bill({ stop_month: 2, stop_year: 2026 }));
    data.payments.push({ bill_id: "b1", amount: 80, month: 3, year: 2026 });

    expect((await computeMonthBalance(3, 2026)).totalBills).toBe(0);
  });

  it("adiantamento sai do mês da conta e entra no mês do pagamento", async () => {
    data.bills.push(bill());
    data.advances.push({
      bill_id: "b1", amount: 90, target_month: 3, target_year: 2026, paid_month: 2, paid_year: 2026,
    });

    expect((await computeMonthBalance(2, 2026)).totalBills).toBe(190);
    expect((await computeMonthBalance(3, 2026)).totalBills).toBe(0);
  });

  it("dízimo é 10% da renda, a menos que o mês tenha valor próprio", async () => {
    data.sources.push(source());
    data.bills.push(bill({ id: "d1", name: "Dízimo", is_tithe: true }));

    expect((await computeMonthBalance(1, 2026)).totalBills).toBe(100);

    clearBalanceCache();
    data.payments.push({ bill_id: "d1", amount: 150, month: 2, year: 2026 });
    expect((await computeMonthBalance(2, 2026)).totalBills).toBe(150);
  });

  it("dízimo encerrado deixa de contar", async () => {
    data.sources.push(source());
    data.bills.push(bill({ id: "d1", name: "Dízimo", is_tithe: true, stop_month: 2, stop_year: 2026 }));

    expect((await computeMonthBalance(1, 2026)).totalBills).toBe(100);
    expect((await computeMonthBalance(2, 2026)).totalBills).toBe(0);
  });
});

describe("computeYearBalances", () => {
  it("acumula a partir do saldo inicial", async () => {
    data.sources.push(source());
    const year = await computeYearBalances(2026, config);

    expect(year[0].saldoAcumulado).toBe(1100);
    expect(year[1].saldoAcumulado).toBe(2100);
    expect(year[11].saldoAcumulado).toBe(12100);
  });

  it("não acumula antes do mês de início", async () => {
    data.sources.push(source());
    const year = await computeYearBalances(2026, { ...config, startMonth: 4 });

    expect(year[2].saldoAcumulado).toBeNull();
    expect(year[3].saldoAcumulado).toBe(1100);
  });

  it("ajuste manual substitui o acumulado e os meses seguintes partem dele", async () => {
    data.sources.push(source());
    data.overrides.push({ month: 2, year: 2026, auto_zero: true, override_amount: 0, notes: "zerado" });
    data.overrides.push({ month: 4, year: 2026, auto_zero: false, override_amount: 200, notes: null });

    const year = await computeYearBalances(2026, config);

    expect(year[1]).toMatchObject({ saldoAcumulado: 0, hasOverride: true, overrideNotes: "zerado" });
    expect(year[2].saldoAcumulado).toBe(1000);
    expect(year[3].saldoAcumulado).toBe(200);
    expect(year[4].saldoAcumulado).toBe(1200);
  });

  it("carrega o saldo entre anos, respeitando ajustes do ano anterior", async () => {
    data.sources.push(source());
    data.overrides.push({ month: 12, year: 2025, auto_zero: false, override_amount: 300, notes: null });

    const year = await computeYearBalances(2026, { ...config, startYear: 2025, startMonth: 11 });

    expect(year[0].saldoAcumulado).toBe(1300);
  });

  it("remover uma conta a partir de um mês não muda os meses anteriores", async () => {
    data.sources.push(source());
    data.bills.push(bill());
    const before = await computeYearBalances(2026, config);

    clearBalanceCache();
    data.bills[0] = bill({ stop_month: 6, stop_year: 2026 });
    const after = await computeYearBalances(2026, config);

    expect(after.slice(0, 5).map(m => m.saldoAcumulado))
      .toEqual(before.slice(0, 5).map(m => m.saldoAcumulado));
    expect(after[5].totalBills).toBe(0);
  });

  it("uma conta nova com início não muda os meses anteriores", async () => {
    data.sources.push(source());
    const before = await computeYearBalances(2026, config);

    clearBalanceCache();
    data.bills.push(bill({ start_month: 11, start_year: 2026 }));
    const after = await computeYearBalances(2026, config);

    expect(after.slice(0, 10).map(m => m.saldoAcumulado))
      .toEqual(before.slice(0, 10).map(m => m.saldoAcumulado));
    expect(after[10].totalBills).toBe(100);
  });
});

describe("consultas", () => {
  it("busca cada ano uma única vez, mesmo com vários anos acumulados", async () => {
    data.sources.push(source());
    await computeYearBalances(2026, { ...config, startYear: 2023 });

    expect(calls.transactions).toBe(4);
    expect(calls.bills).toBe(1);
  });

  it("reaproveita os dados até o cache ser limpo", async () => {
    await computeMonthBalance(1, 2026);
    await computeMonthBalance(2, 2026);
    expect(calls.transactions).toBe(1);

    clearBalanceCache();
    await computeMonthBalance(1, 2026);
    expect(calls.transactions).toBe(2);
  });

  it("cargas simultâneas do mesmo ano dividem a mesma busca", async () => {
    await Promise.all([computeMonthBalance(1, 2026), computeMonthBalance(2, 2026)]);
    expect(calls.transactions).toBe(1);
  });

  it("janeiro não busca o ano atual sem precisar", async () => {
    await computePrevBalance(1, 2027, config);
    expect(calls.transactions).toBe(1);
  });
});

describe("computePrevBalance", () => {
  it("no mês de início retorna o saldo inicial", async () => {
    expect(await computePrevBalance(1, 2026, config)).toBe(100);
  });

  it("retorna o acumulado do mês anterior", async () => {
    data.sources.push(source());
    expect(await computePrevBalance(3, 2026, config)).toBe(2100);
  });

  it("em janeiro usa dezembro do ano anterior", async () => {
    data.sources.push(source());
    const prev = await computePrevBalance(1, 2027, config);
    expect(prev).toBe(12100);
  });

  it("sem configuração informada usa a do banco", async () => {
    data.sources.push(source());
    expect(await computePrevBalance(2, 2026)).toBe(1000);
  });
});
