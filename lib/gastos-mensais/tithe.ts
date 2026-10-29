import { resolveSourceAmount } from "@/lib/utils";
import type { IncomeSource, IncomeSourceAmount, MonthlyIncome } from "@/types";

/** Percentual recomendado do dízimo sobre a renda do mês */
export const TITHE_RATE = 0.1;

/** A partir deste mês/ano (novembro/2026) o dízimo pode ser detalhado por renda */
const TITHE_BREAKDOWN_START = { month: 11, year: 2026 };

export function hasTitheBreakdown(month: number, year: number) {
  return year * 12 + month >= TITHE_BREAKDOWN_START.year * 12 + TITHE_BREAKDOWN_START.month;
}

/** Calcula 10% da renda agrupado por owner e por fonte de renda (sem nomes fixos) */
export function calcTithe(
  sources: IncomeSource[], incomes: MonthlyIncome[],
  month: number, year: number, srcAmts: IncomeSourceAmount[],
) {
  const sourceBase = (s: IncomeSource) =>
    incomes.find(i => i.source_id === s.id)?.amount ?? resolveSourceAmount(s, month, year, srcAmts);

  const owners = Array.from(new Set(sources.map(s => s.owner)));
  const byOwner: Record<string, { base: number; tithe: number }> = {};

  owners.forEach(owner => {
    const base = sources
      .filter(s => s.owner === owner)
      .reduce((acc, s) => acc + sourceBase(s), 0);
    byOwner[owner] = { base, tithe: base * TITHE_RATE };
  });

  const bySource = sources.map(s => {
    const base = sourceBase(s);
    return { id: s.id, name: s.name, owner: s.owner, base, tithe: base * TITHE_RATE };
  });

  const total = Object.values(byOwner).reduce((s, v) => s + v.base, 0) * TITHE_RATE;
  return { byOwner, bySource, total };
}

export type TitheBreakdown = ReturnType<typeof calcTithe>;
