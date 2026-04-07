"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, Sparkles, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Category } from "@/types";

export type TxSuggestion = {
  description: string;
  category: string | null;
  amount: number;
  count: number;
};

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Chamado ao selecionar uma sugestão — preenche description, category e amount */
  onSelect: (s: TxSuggestion) => void;
  suggestions: TxSuggestion[];
  categories: Category[];
  placeholder?: string;
  disabled?: boolean;
}

const MAX_SHOWN = 8;

export function DescriptionAutocomplete({
  value,
  onChange,
  onSelect,
  suggestions,
  categories,
  placeholder = "Ex: Supermercado Assaí",
  disabled,
}: Props) {
  const [open, setOpen]     = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [pos, setPos]       = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Só usar portal no browser
  useEffect(() => { setMounted(true); }, []);

  // ── Filtro de sugestões ──────────────────────────────────────────────────────
  const filtered = (() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions.slice(0, MAX_SHOWN);
    const starts   = suggestions.filter(s => s.description.toLowerCase().startsWith(q));
    const contains = suggestions.filter(
      s => !s.description.toLowerCase().startsWith(q) && s.description.toLowerCase().includes(q),
    );
    return [...starts, ...contains].slice(0, MAX_SHOWN);
  })();

  const isNew =
    value.trim().length > 1 &&
    !suggestions.some(s => s.description.toLowerCase() === value.trim().toLowerCase());

  const showDropdown = open && (filtered.length > 0 || isNew);

  // ── Posicionamento (viewport-relative para position:fixed) ───────────────────
  const updatePos = useCallback(() => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    // Se não há espaço abaixo, mostrar acima
    const spaceBelow = window.innerHeight - r.bottom;
    const dropH = Math.min(filtered.length, MAX_SHOWN) * 44 + 32;
    const top = spaceBelow < dropH && r.top > dropH ? r.top - dropH - 4 : r.bottom + 4;
    setPos({ top, left: r.left, width: r.width });
  }, [filtered.length]);

  // Reposicionar ao rolar (captura em todos os elementos, inclusive o modal)
  useEffect(() => {
    if (!open) return;
    document.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      document.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  // Fechar ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      const dropdown = document.getElementById("desc-autocomplete-dropdown");
      if (
        !containerRef.current?.contains(e.target as Node) &&
        !dropdown?.contains(e.target as Node)
      ) {
        setOpen(false);
        setCursor(-1);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Teclado ─────────────────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) { if (e.key === "ArrowDown") { setOpen(true); updatePos(); } return; }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setCursor(c => Math.min(c + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setCursor(c => Math.max(c - 1, 0));
        break;
      case "Enter":
        if (cursor >= 0 && filtered[cursor]) {
          e.preventDefault();
          select(filtered[cursor]);
        }
        break;
      case "Escape":
        setOpen(false);
        setCursor(-1);
        break;
    }
  }

  function select(s: TxSuggestion) {
    onSelect(s);
    setOpen(false);
    setCursor(-1);
    inputRef.current?.blur();
  }

  // ── Dropdown ─────────────────────────────────────────────────────────────────
  const dropdown = showDropdown && mounted
    ? createPortal(
        <div
          id="desc-autocomplete-dropdown"
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl overflow-hidden"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
        >
          {filtered.length > 0 && (
            <div>
              {/* Cabeçalho sutil */}
              <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
                <Clock size={10} className="text-slate-300 dark:text-slate-600" />
                <span className="text-[10px] font-medium text-slate-300 dark:text-slate-600 uppercase tracking-wider">
                  Histórico
                </span>
              </div>
              {filtered.map((s, i) => {
                const catObj = categories.find(c => c.name === s.category);
                return (
                  <button
                    key={s.description}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); select(s); }}
                    onMouseEnter={() => setCursor(i)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-t border-slate-50 dark:border-slate-700/30 first:border-0 ${
                      i === cursor
                        ? "bg-primary-50 dark:bg-primary-900/30"
                        : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    }`}
                  >
                    {/* Descrição */}
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate min-w-0">
                      {s.description}
                    </span>

                    {/* Badge de categoria */}
                    {s.category && (
                      <span
                        className="text-[11px] font-medium px-1.5 py-0.5 rounded-full shrink-0 capitalize"
                        style={
                          catObj?.color
                            ? { backgroundColor: `${catObj.color}22`, color: catObj.color }
                            : { backgroundColor: "rgb(239 246 255)", color: "rgb(29 78 216)" }
                        }
                      >
                        {s.category}
                      </span>
                    )}

                    {/* Valor típico */}
                    {s.amount > 0 && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                        {formatCurrency(s.amount)}
                      </span>
                    )}

                    {/* Contagem de uso */}
                    {s.count > 1 && (
                      <span className="text-[10px] text-slate-300 dark:text-slate-600 shrink-0">
                        {s.count}×
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Dica para descrição nova */}
          {isNew && (
            <div
              className={`flex items-center gap-2 px-3 py-2 text-xs text-slate-400 dark:text-slate-500 ${
                filtered.length > 0 ? "border-t border-slate-100 dark:border-slate-700/50" : ""
              }`}
            >
              <Sparkles size={11} className="shrink-0 text-primary-400" />
              <span>
                <span className="font-medium text-slate-600 dark:text-slate-300 truncate">
                  &ldquo;{value.trim()}&rdquo;
                </span>{" "}
                — nova. Será sugerida automaticamente após salvar.
              </span>
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          className="input pr-8"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onChange={e => {
            onChange(e.target.value);
            setCursor(-1);
            setOpen(true);
          }}
          onFocus={() => {
            updatePos();
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <Search
          size={13}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none"
        />
      </div>
      {dropdown}
    </div>
  );
}
