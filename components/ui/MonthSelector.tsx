"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS } from "@/types";

interface MonthSelectorProps {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}

export function MonthSelector({ month, year, onChange }: MonthSelectorProps) {
  const prev = () => {
    if (month === 1) onChange(12, year - 1);
    else onChange(month - 1, year);
  };
  const next = () => {
    if (month === 12) onChange(1, year + 1);
    else onChange(month + 1, year);
  };

  return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-1 py-1 transition-colors">
      <button
        onClick={prev}
        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      >
        <ChevronLeft size={16} className="text-slate-600 dark:text-slate-300" />
      </button>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[110px] text-center">
        {MONTHS[month - 1]} {year}
      </span>
      <button
        onClick={next}
        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      >
        <ChevronRight size={16} className="text-slate-600 dark:text-slate-300" />
      </button>
    </div>
  );
}
