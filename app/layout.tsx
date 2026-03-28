import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";

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
          <ToastProvider>
            <LayoutShell>{children}</LayoutShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
