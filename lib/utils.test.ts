import { describe, expect, it } from "vitest";
import {
  capitalizeWords, computeInstallment, getLocalDateString, isBillActiveInMonth,
  isSourceActiveInMonth, normalizeText, resolveSourceAmount, sumTransactions,
} from "./utils";
import type { CardTransaction, FixedBill, IncomeSource, IncomeSourceAmount } from "@/types";

const bill = (patch: Partial<FixedBill> = {}) => ({
  start_month: null, start_year: null, stop_month: null, stop_year: null,
  installment_total: null, installment_current: null,
  installment_start_month: null, installment_start_year: null,
  ...patch,
}) as FixedBill;

const source = (patch: Partial<IncomeSource> = {}) => ({
  id: "s1", base_amount: 1000, is_recurring: true,
  one_time_month: null, one_time_year: null,
  start_month: null, start_year: null, stop_month: null, stop_year: null,
  ...patch,
}) as IncomeSource;

describe("capitalizeWords", () => {
  it("coloca maiúscula na primeira letra de cada palavra", () => {
    expect(capitalizeWords("açaí da barra")).toBe("Açaí Da Barra");
    expect(capitalizeWords("água/luz")).toBe("Água/Luz");
    expect(capitalizeWords("coca-cola 2l")).toBe("Coca-Cola 2l");
    expect(capitalizeWords("mercado (éter)")).toBe("Mercado (Éter)");
  });

  it("preserva o que já está em maiúsculas", () => {
    expect(capitalizeWords("INTER")).toBe("INTER");
  });

  it("limpa espaços sobrando", () => {
    expect(capitalizeWords("  mercado   livre ")).toBe("Mercado Livre");
  });
});

describe("normalizeText", () => {
  it("ignora acentos, cedilha, til e maiúsculas", () => {
    expect(normalizeText(" Açaí ")).toBe("acai");
    expect(normalizeText("MAÇÃ")).toBe("maca");
  });
});

describe("getLocalDateString", () => {
  it("usa o dia local, mesmo perto da virada do dia", () => {
    expect(getLocalDateString(new Date(2026, 11, 31, 22, 30))).toBe("2026-12-31");
    expect(getLocalDateString(new Date(2026, 2, 5, 0, 10))).toBe("2026-03-05");
  });
});

describe("sumTransactions", () => {
  it("estorno reduz o total", () => {
    const txs = [{ amount: -500 }, { amount: 50 }] as CardTransaction[];
    expect(sumTransactions(txs)).toBe(450);
  });
});

describe("isBillActiveInMonth", () => {
  it("conta sem datas vale em todos os meses", () => {
    expect(isBillActiveInMonth(bill(), 1, 2020)).toBe(true);
  });

  it("conta com início não entra nos meses anteriores", () => {
    const b = bill({ start_month: 11, start_year: 2026 });
    expect(isBillActiveInMonth(b, 10, 2026)).toBe(false);
    expect(isBillActiveInMonth(b, 11, 2026)).toBe(true);
    expect(isBillActiveInMonth(b, 1, 2027)).toBe(true);
  });

  it("conta encerrada vale até o mês anterior ao encerramento", () => {
    const b = bill({ stop_month: 3, stop_year: 2026 });
    expect(isBillActiveInMonth(b, 12, 2025)).toBe(true);
    expect(isBillActiveInMonth(b, 2, 2026)).toBe(true);
    expect(isBillActiveInMonth(b, 3, 2026)).toBe(false);
  });

  it("parcelada vale só dentro do período e ignora o início recorrente", () => {
    const b = bill({
      installment_total: 3, installment_start_month: 11, installment_start_year: 2025,
      start_month: 1, start_year: 2026,
    });
    expect(isBillActiveInMonth(b, 10, 2025)).toBe(false);
    expect(isBillActiveInMonth(b, 11, 2025)).toBe(true);
    expect(isBillActiveInMonth(b, 1, 2026)).toBe(true);
    expect(isBillActiveInMonth(b, 2, 2026)).toBe(false);
  });

  it("encerrar vale também para parcelada", () => {
    const b = bill({
      installment_total: 3, installment_start_month: 11, installment_start_year: 2025,
      stop_month: 12, stop_year: 2025,
    });
    expect(isBillActiveInMonth(b, 12, 2025)).toBe(false);
  });

  it("parcelada sem data de início continua visível", () => {
    expect(isBillActiveInMonth(bill({ installment_total: 5 }), 6, 2026)).toBe(true);
  });
});

describe("computeInstallment", () => {
  const b = bill({ installment_total: 4, installment_start_month: 11, installment_start_year: 2025 });

  it("calcula a parcela atravessando o ano", () => {
    expect(computeInstallment(b, 2, 2026)).toEqual({ current: 4, total: 4 });
  });

  it("retorna null fora do período", () => {
    expect(computeInstallment(b, 10, 2025)).toBeNull();
    expect(computeInstallment(b, 3, 2026)).toBeNull();
  });
});

describe("isSourceActiveInMonth", () => {
  it("receita avulsa vale só no próprio mês", () => {
    const s = source({ is_recurring: false, one_time_month: 7, one_time_year: 2026 });
    expect(isSourceActiveInMonth(s, 7, 2026)).toBe(true);
    expect(isSourceActiveInMonth(s, 8, 2026)).toBe(false);
  });

  it("recorrente respeita início e encerramento", () => {
    const s = source({ start_month: 3, start_year: 2026, stop_month: 6, stop_year: 2026 });
    expect(isSourceActiveInMonth(s, 2, 2026)).toBe(false);
    expect(isSourceActiveInMonth(s, 5, 2026)).toBe(true);
    expect(isSourceActiveInMonth(s, 6, 2026)).toBe(false);
  });
});

describe("resolveSourceAmount", () => {
  const amounts = [
    { source_id: "s1", amount: 1500, effective_month: 3, effective_year: 2026 },
    { source_id: "s1", amount: 2000, effective_month: 8, effective_year: 2026 },
    { source_id: "outra", amount: 9000, effective_month: 1, effective_year: 2020 },
  ] as IncomeSourceAmount[];

  it("usa o valor vigente mais recente da própria fonte", () => {
    expect(resolveSourceAmount(source(), 7, 2026, amounts)).toBe(1500);
    expect(resolveSourceAmount(source(), 8, 2026, amounts)).toBe(2000);
  });

  it("antes da primeira vigência usa o valor base", () => {
    expect(resolveSourceAmount(source(), 1, 2026, amounts)).toBe(1000);
  });
});
