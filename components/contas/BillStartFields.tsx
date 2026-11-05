"use client";

import { Toggle } from "@/components/ui/Toggle";
import { MONTHS } from "@/types";
import type { FixedBill } from "@/types";

interface BillStartFieldsProps {
  value: Partial<FixedBill>;
  onChange: (patch: Partial<FixedBill>) => void;
  /** Mês sugerido ao ligar a opção */
  month: number;
  year: number;
}

/** Mês em que uma conta recorrente começa. Parceladas usam o início das parcelas. */
export function BillStartFields({ value, onChange, month, year }: BillStartFieldsProps) {
  if (value.installment_total) return null;

  const hasStart = value.start_month != null && value.start_year != null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Começa em um mês</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {hasStart
              ? "Os meses anteriores não mudam"
              : "Desligado, a conta entra em todos os meses, inclusive os passados"}
          </p>
        </div>
        <Toggle
          checked={hasStart}
          onChange={on => onChange(on
            ? { start_month: month, start_year: year }
            : { start_month: null, start_year: null })}
        />
      </div>

      {hasStart && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Mês de início</label>
            <select className="input" value={value.start_month ?? month}
              onChange={e => onChange({ start_month: Number(e.target.value) })}>
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ano de início</label>
            <input className="input" type="number"
              value={value.start_year ?? year}
              onChange={e => onChange({ start_year: Number(e.target.value) || year })} />
          </div>
        </div>
      )}
    </div>
  );
}
