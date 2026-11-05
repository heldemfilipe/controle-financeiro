import { describe, expect, it } from "vitest";
import { buildCategoryMap, sumCategories } from "./analise";
import type { FixedBill } from "@/types";

const bill = (id: string, category: string, amount: number) =>
  ({ id, category, amount }) as FixedBill;

const base = {
  bills: [],
  amountOf: (b: FixedBill) => b.amount,
  advancedBillIds: new Set<string>(),
  advancesMade: [],
  tithe: null,
  cardTotals: {},
};

describe("buildCategoryMap", () => {
  it("o dízimo entra na categoria dele", () => {
    const map = buildCategoryMap({
      ...base,
      bills: [bill("b1", "essencial", 850)],
      tithe: { category: "essencial", amount: 3690 },
      cardTotals: { essencial: 310 },
    });
    expect(map.essencial).toBe(4850);
  });

  it("conta antecipada sai do mês, e o adiantamento entra no mês em que foi pago", () => {
    const map = buildCategoryMap({
      ...base,
      bills: [bill("b1", "essencial", 100), bill("b2", "lazer", 50)],
      advancedBillIds: new Set(["b1"]),
      advancesMade: [{ category: "outros", amount: 70 }],
    });
    expect(map).toEqual({ lazer: 50, outros: 70 });
  });

  it("categoria só com estorno reduz o total", () => {
    const map = buildCategoryMap({
      ...base,
      bills: [bill("b1", "essencial", 100)],
      cardTotals: { lazer: -30 },
    });
    expect(sumCategories(map)).toBe(70);
  });

  it("sem categoria definida usa os mesmos padrões do saldo", () => {
    const map = buildCategoryMap({
      ...base,
      bills: [bill("b1", "", 10)],
      tithe: { category: null, amount: 5 },
    });
    expect(map).toEqual({ outros: 10, essencial: 5 });
  });
});
