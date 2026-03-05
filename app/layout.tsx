import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME
    ? `Controle Financeiro | ${process.env.NEXT_PUBLIC_APP_NAME}`
    : "Controle Financeiro",
  description: "Sistema de controle financeiro pessoal com Supabase e Next.js",
};

// Anti-flash: aplica o tema ANTES do primeiro paint para evitar piscar
const themeScript = `(function(){try{var t=localStorage.getItem('cf-theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||(t!=='light'&&d)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200">
            <Sidebar />
            <main className="flex-1 ml-[240px] min-h-screen">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
