"use client";

import { formatCurrency } from "@/lib/utils";

interface TooltipEntry {
  name: string;
  value: number;
  color?: string;
  fill?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  /** Formata o valor exibido. Padrão: formatCurrency */
  formatter?: (value: number, name: string) => string;
}

/**
 * Tooltip customizado para Recharts com suporte a dark mode.
 * Uso: <Tooltip content={<ChartTooltip />} />
 * Com formatter: <Tooltip content={<ChartTooltip formatter={v => `${v}%`} />} />
 */
export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const fmt = formatter ?? ((v: number) => formatCurrency(v));

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-3 shadow-lg text-xs">
      {label && (
        <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">{label}</p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color ?? p.fill }}>{p.name}</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {fmt(p.value, p.name)}
          </span>
        </div>
      ))}
    </div>
  );
}
