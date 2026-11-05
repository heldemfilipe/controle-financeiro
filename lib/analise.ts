import type { FixedBill } from "@/types";

interface CategoryAmount {
  category: string | null | undefined;
  amount: number;
}

interface CategoryMapInput {
  /** Contas que valem no mês, sem o dízimo */
  bills: FixedBill[];
  /** Valor da conta no mês, considerando o lançamento mensal */
  amountOf: (bill: FixedBill) => number;
  /** Contas pagas antecipadamente em outro mês: não pesam neste */
  advancedBillIds: Set<string>;
  /** Adiantamentos pagos neste mês: pesam aqui, mesmo sendo de meses futuros */
  advancesMade: CategoryAmount[];
  tithe: CategoryAmount | null;
  /** Total líquido dos cartões por categoria; estornos entram negativos */
  cardTotals: Record<string, number>;
}

/** Soma os gastos por categoria com as mesmas regras do saldo do mês (lib/balance.ts). */
export function buildCategoryMap({
  bills, amountOf, advancedBillIds, advancesMade, tithe, cardTotals,
}: CategoryMapInput): Record<string, number> {
  const map: Record<string, number> = {};
  const add = (category: string, amount: number) => {
    map[category] = (map[category] ?? 0) + amount;
  };

  bills
    .filter(bill => !advancedBillIds.has(bill.id))
    .forEach(bill => add(bill.category || "outros", amountOf(bill)));
  advancesMade.forEach(advance => add(advance.category || "outros", advance.amount));
  if (tithe && tithe.amount > 0) add(tithe.category || "essencial", tithe.amount);
  Object.entries(cardTotals).forEach(([category, total]) => add(category, total));

  return map;
}

/** Soma todas as categorias, inclusive as que ficaram negativas por estorno */
export function sumCategories(map: Record<string, number>): number {
  return Object.values(map).reduce((sum, value) => sum + value, 0);
}
