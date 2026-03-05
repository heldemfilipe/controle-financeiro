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
  /** Exibe bolinha colorida ao lado do nome. Padrão: false */
  showDot?: boolean;
}

/**
 * Tooltip customizado para Recharts com suporte a dark mode.
 * Uso: <Tooltip content={<ChartTooltip />} />
 * Com dot:      <Tooltip content={<ChartTooltip showDot />} />
 * Com formatter: <Tooltip content={<ChartTooltip formatter={v => `${v}%`} />} />
 */
export function ChartTooltip({ active, payload, label, formatter, showDot = false }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const fmt = formatter ?? ((v: number) => formatCurrency(v));

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-3 shadow-lg text-xs min-w-[160px]">
      {label && (
        <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">{label}</p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            {showDot && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.color ?? p.fill }}
              />
            )}
            <span style={showDot ? undefined : { color: p.color ?? p.fill }}>
              {p.name}
            </span>
          </span>
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {fmt(p.value, p.name)}
          </span>
        </div>
      ))}
    </div>
  );
}
