import { resolveSourceAmount } from "@/lib/utils";
import type { IncomeSource, IncomeSourceAmount, MonthlyIncome } from "@/types";

/** Calcula 10% da renda agrupado dinamicamente por owner (sem nomes fixos) */
export function calcTithe(
  sources: IncomeSource[], incomes: MonthlyIncome[],
  month: number, year: number, srcAmts: IncomeSourceAmount[],
) {
  const owners = Array.from(new Set(sources.map(s => s.owner)));
  const byOwner: Record<string, { base: number; tithe: number }> = {};

  owners.forEach(owner => {
    const base = sources
      .filter(s => s.owner === owner)
      .reduce((acc, s) => acc + (incomes.find(i => i.source_id === s.id)?.amount ?? resolveSourceAmount(s, month, year, srcAmts)), 0);
    byOwner[owner] = { base, tithe: base * 0.1 };
  });

  const total = Object.values(byOwner).reduce((s, v) => s + v.base, 0) * 0.1;
  return { byOwner, total };
}
