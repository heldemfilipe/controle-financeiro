"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { saveProduct } from "@/lib/queries";
import { capitalizeWords, normalizeText } from "@/lib/utils";
import type { Category, ProductSuggestion } from "@/types";

/** "new" abre o formulário vazio; null mantém o modal fechado */
export type ProductEditTarget = ProductSuggestion | "new" | null;

interface ProductEditModalProps {
  target: ProductEditTarget;
  onClose: () => void;
  onSaved: (saved: ProductSuggestion, previous: ProductSuggestion | null) => void;
  categories: Category[];
  products: ProductSuggestion[];
}

export function ProductEditModal({ target, onClose, onSaved, categories, products }: ProductEditModalProps) {
  const product = target && target !== "new" ? target : null;

  const [name, setName]         = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount]     = useState("");
  const [applyCategory, setApplyCategory] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    setName(product?.description ?? "");
    setCategory(product?.category ?? "");
    setAmount(product?.amount ? String(product.amount) : "");
    setApplyCategory(false);
    setError(null);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const key = normalizeText(name);
  const nameChanged = !!product && capitalizeWords(name) !== product.description;
  const categoryChanged = !!product && (category || null) !== product.category;
  const duplicate = products.find(p => p.key === key && p.key !== product?.key);
  const hasHistory = !!product && product.count > 0;

  async function save() {
    if (!key) { setError("Informe o nome do produto"); return; }
    const parsedAmount = amount.trim() ? Number(amount) : null;
    if (parsedAmount !== null && (Number.isNaN(parsedAmount) || parsedAmount < 0)) {
      setError("Valor inválido");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await saveProduct(
        product,
        { name, category: category || null, amount: parsedAmount },
        { applyCategoryToHistory: categoryChanged && applyCategory },
      );
      onSaved(saved, product);
    } catch (err) {
      console.error("Erro ao salvar produto:", err);
      setError(err instanceof Error ? err.message : "Erro ao salvar o produto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!target} onClose={onClose} title={product ? "Editar Produto" : "Novo Produto"} size="sm">
      <div className="space-y-4">
        <div>
          <label className="label">Nome</label>
          <input
            className="input"
            placeholder="Ex: Açaí Da Barra"
            value={name}
            autoFocus
            onChange={e => setName(e.target.value)}
          />
          {duplicate ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Já existe &ldquo;{duplicate.description}&rdquo;. Ao salvar, os dois viram um só produto.
            </p>
          ) : nameChanged && hasHistory ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {countLabel(product.count)} {product.count === 1 ? "passará" : "passarão"} a usar este nome.
            </p>
          ) : null}
        </div>

        <div>
          <label className="label">Categoria</label>
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Sem categoria</option>
            {category && !categories.some(c => c.name === category) && (
              <option value={category}>{category}</option>
            )}
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {categoryChanged && hasHistory && (
          <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Aplicar ao histórico</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Muda a categoria de {countLabel(product.count)}
              </p>
            </div>
            <Toggle checked={applyCategory} onChange={setApplyCategory} />
          </div>
        )}

        <div>
          <label className="label">Valor sugerido (R$)</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Vale para os próximos lançamentos. Os já feitos não mudam.
          </p>
        </div>

        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function countLabel(count: number) {
  return count === 1 ? "1 lançamento" : `${count} lançamentos`;
}
