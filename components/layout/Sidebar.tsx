"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, PlusCircle, CalendarDays, CreditCard,
  TrendingUp, DollarSign, BarChart2, AreaChart, Settings,
  Sun, Moon, PieChart, LogOut, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const navGroups = [
  {
    label: "Visão Geral",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/gastos-anuais", label: "Anual", icon: AreaChart },
    ],
  },
  {
    label: "Controle Mensal",
    items: [
      { href: "/lancamentos", label: "Lançamentos", icon: PlusCircle },
      { href: "/gastos-mensais", label: "Gastos do Mês", icon: CalendarDays },
      { href: "/faturas", label: "Faturas", icon: CreditCard },
    ],
  },
  {
    label: "Análise",
    items: [
      { href: "/analise", label: "Por Categoria", icon: PieChart },
      { href: "/gastos-cartoes", label: "Gastos Cartões", icon: BarChart2 },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleLogout() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-[240px] bg-slate-900 text-white flex flex-col z-50">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <TrendingUp size={16} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm text-white">Controle</p>
            <p className="text-xs text-slate-400">Financeiro</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center shrink-0">
              <User size={13} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">
                {process.env.NEXT_PUBLIC_APP_NAME ?? "Minha Família"}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {userEmail ?? "…"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto">
        <div className="space-y-4">
          {navGroups.map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-slate-500 px-2 mb-1.5 uppercase tracking-wider">
                {label}
              </p>
              <ul className="space-y-0.5">
                {items.map(({ href, label: itemLabel, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                          active
                            ? "bg-primary-600/20 text-primary-400 border border-primary-600/30"
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                        )}
                      >
                        <Icon size={15} className={active ? "text-primary-400" : ""} />
                        {itemLabel}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer — Dark mode toggle */}
      <div className="p-4 border-t border-slate-700/50">
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                     bg-slate-800/60 hover:bg-slate-700/60 transition-colors group"
          title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
        >
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
              theme === "dark"
                ? "bg-amber-400/20 text-amber-400"
                : "bg-slate-600 text-slate-300"
            )}>
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </div>
            <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
              {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
            </span>
          </div>

          {/* Toggle visual */}
          <div className={cn(
            "w-8 h-4 rounded-full transition-all relative",
            theme === "dark" ? "bg-amber-400/30" : "bg-slate-600"
          )}>
            <div className={cn(
              "absolute top-0.5 w-3 h-3 rounded-full shadow transition-all",
              theme === "dark"
                ? "translate-x-4 bg-amber-400"
                : "translate-x-0.5 bg-slate-400"
            )} />
          </div>
        </button>

        <p className="text-xs text-slate-600 text-center mt-2">v1.0.0 · MIT</p>
      </div>
    </aside>
  );
}
