import { capitalizeWords, normalizeText } from "./utils";
import type { ProductSuggestion, SavedProduct } from "@/types";

export type ProductTxRow = {
  description: string;
  category: string | null;
  amount: number;
};

/**
 * Monta a lista de produtos a partir dos lançamentos, aplicando as alterações salvas.
 * Sem alteração, a categoria é a mais usada e o valor é a mediana do histórico.
 */
export function buildProducts(rows: ProductTxRow[], saved: SavedProduct[]): ProductSuggestion[] {
  type Group = {
    description: string;
    cats: Map<string, number>;
    amounts: number[];
    variants: Set<string>;
  };
  const groups = new Map<string, Group>();

  for (const tx of rows) {
    const key = normalizeText(tx.description);
    if (!key) continue;
    let group = groups.get(key);
    if (!group) {
      group = { description: tx.description, cats: new Map(), amounts: [], variants: new Set() };
      groups.set(key, group);
    }
    group.amounts.push(Math.abs(tx.amount));
    group.variants.add(tx.description);
    if (tx.category) group.cats.set(tx.category, (group.cats.get(tx.category) ?? 0) + 1);
  }

  const savedByKey = new Map(saved.map(s => [s.key, s]));

  const products: ProductSuggestion[] = Array.from(groups.entries()).map(([key, g]) => {
    let topCategory: string | null = null;
    let topCount = 0;
    g.cats.forEach((n, cat) => { if (n > topCount) { topCount = n; topCategory = cat; } });

    const sorted = [...g.amounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

    const s = savedByKey.get(key);
    return {
      key,
      description: s?.name ?? capitalizeWords(g.description),
      category: s?.category ?? topCategory,
      amount: s?.amount ?? parseFloat(median.toFixed(2)),
      count: g.amounts.length,
      hidden: s?.hidden ?? false,
      variants: Array.from(g.variants),
    };
  });

  // Produtos criados à mão, ainda sem lançamentos
  for (const s of saved) {
    if (groups.has(s.key)) continue;
    products.push({
      key: s.key,
      description: s.name,
      category: s.category,
      amount: s.amount ?? 0,
      count: 0,
      hidden: s.hidden,
      variants: [],
    });
  }

  return products.sort((a, b) => b.count - a.count);
}
