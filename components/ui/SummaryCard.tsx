import { formatCurrency } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant: "income" | "expense" | "balance" | "card";
  subtitle?: string;
}

const variants = {
  income: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    icon: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-100 dark:border-emerald-800/40",
  },
  expense: {
    bg: "bg-red-50 dark:bg-red-900/20",
    icon: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",
    value: "text-red-700 dark:text-red-400",
    border: "border-red-100 dark:border-red-800/40",
  },
  balance: {
    bg: "bg-primary-50 dark:bg-primary-900/20",
    icon: "bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400",
    value: "text-primary-700 dark:text-primary-400",
    border: "border-primary-100 dark:border-primary-800/40",
  },
  card: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    icon: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-400",
    border: "border-amber-100 dark:border-amber-800/40",
  },
};

export function SummaryCard({ title, value, icon: Icon, variant, subtitle }: SummaryCardProps) {
  const styles = variants[variant];
  return (
    <div className={`${styles.bg} border ${styles.border} rounded-xl p-4 transition-colors`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">{title}</p>
          <p className={`text-xl font-bold ${styles.value}`}>
            {formatCurrency(value)}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className={`${styles.icon} p-2 rounded-xl`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
