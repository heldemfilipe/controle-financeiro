"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const colors: Record<ToastType, string> = {
    success: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200",
    error: "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200",
    info: "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
  };

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />,
    error: <AlertTriangle size={16} className="text-red-500 shrink-0" />,
    info: <CheckCircle2 size={16} className="text-blue-500 shrink-0" />,
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium animate-slide-in ${colors[t.type]}`}
            >
              {icons[t.type]}
              <span className="flex-1">{t.message}</span>
              <button onClick={() => remove(t.id)} className="p-0.5 opacity-60 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
