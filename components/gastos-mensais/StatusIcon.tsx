"use client";

import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export function StatusIcon({ status }: { status: "paid" | "overdue" | "pending" }) {
  if (status === "paid")   return <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />;
  if (status === "overdue") return <AlertTriangle size={15} className="text-red-500 shrink-0" />;
  return <Clock size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />;
}
