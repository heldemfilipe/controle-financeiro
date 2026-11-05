import { describe, expect, it } from "vitest";
import { buildProducts, type ProductTxRow } from "./products";
import type { SavedProduct } from "@/types";

const row = (description: string, amount: number, category: string | null = null): ProductTxRow =>
  ({ description, amount, category });

const saved = (key: string, name: string, patch: Partial<SavedProduct> = {}): SavedProduct => ({
  id: key, key, name, category: null, amount: null, hidden: false, created_at: "", ...patch,
});

describe("buildProducts", () => {
  it("une grafias diferentes em um produto, com mediana e categoria mais usada", () => {
    const products = buildProducts([
      row("acai da barra", -85, "fast-food"),
      row("Açaí Da Barra", -90, "fast-food"),
      row("AÇAI DA BARRA", -20, "lazer"),
    ], []);

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      key: "acai da barra", description: "Acai Da Barra",
      amount: 85, category: "fast-food", count: 3,
    });
    expect(products[0].variants).toHaveLength(3);
  });

  it("a alteração salva tem prioridade e o que está vazio segue o histórico", () => {
    const [product] = buildProducts([row("x", -10, "a")], [saved("x", "X Novo", { amount: 50 })]);
    expect(product).toMatchObject({ description: "X Novo", amount: 50, category: "a" });
  });

  it("mantém oculto na lista completa, marcado", () => {
    const [product] = buildProducts([row("x", -10)], [saved("x", "X", { hidden: true })]);
    expect(product.hidden).toBe(true);
  });

  it("inclui produto sem lançamentos depois dos usados", () => {
    const products = buildProducts([row("a", -1)], [saved("novo", "Novo", { amount: 7 })]);
    expect(products.map(p => [p.key, p.count, p.amount])).toEqual([["a", 1, 1], ["novo", 0, 7]]);
  });
});
