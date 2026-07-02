"use client";

import { formatCurrency } from "@/lib/utils";

interface TotalSummaryCardProps {
  label: string;
  value: number;
  variant: "emerald" | "primary";
}

const VARIANTS: Record<TotalSummaryCardProps["variant"], { box: string; text: string }> = {
  emerald: {
    box: "mt-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-3 flex justify-between items-center transition-colors",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  primary: {
    box: "mt-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 rounded-xl p-3 flex justify-between items-center transition-colors",
    text: "text-primary-700 dark:text-primary-400",
  },
};

export function TotalSummaryCard({ label, value, variant }: TotalSummaryCardProps) {
  const v = VARIANTS[variant];
  return (
    <div className={v.box}>
      <span className={`text-sm font-medium ${v.text}`}>{label}</span>
      <span className={`text-lg font-bold ${v.text}`}>{formatCurrency(value)}</span>
    </div>
  );
}
