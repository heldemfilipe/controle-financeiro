"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, TrendingUp, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fecha sidebar ao trocar de rota (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200">
      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 z-40 bg-slate-900 border-b border-slate-700/50 flex items-center px-4 gap-3">
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Abrir menu"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
            <TrendingUp size={14} className="text-white" />
          </div>
          <span className="font-semibold text-white text-sm">Controle Financeiro</span>
        </div>
      </header>

      {/* Backdrop overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar wrapper */}
      <div className={cn(
        "fixed top-0 left-0 h-full w-[240px] z-50 transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="md:ml-[240px] pt-14 md:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
