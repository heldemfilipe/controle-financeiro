"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Package, Pencil, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { ProductEditModal, type ProductEditTarget } from "@/components/produtos/ProductEditModal";
import { getCategories, getProducts, setProductHidden } from "@/lib/queries";
import { formatCurrency, normalizeText } from "@/lib/utils";
import type { Category, ProductSuggestion } from "@/types";

export default function ProdutosPage() {
  const [products, setProducts]     = useState<ProductSuggestion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [search, setSearch]         = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductEditTarget>(null);

  const { toast } = useToast();

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const [prods, cats] = await Promise.all([getProducts(), getCategories()]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
      toast("Erro ao carregar produtos", "error");
    } finally {
      setLoaded(true);
    }
  }

  async function toggleHidden(product: ProductSuggestion) {
    try {
      await setProductHidden(product, !product.hidden);
      toast(product.hidden ? "Produto voltou às sugestões" : "Produto oculto das sugestões");
      await load();
    } catch (err) {
      console.error("Erro ao ocultar produto:", err);
      toast(err instanceof Error ? err.message : "Erro ao ocultar produto", "error");
    }
  }

  const hiddenCount = products.filter(p => p.hidden).length;

  const visible = useMemo(() => {
    const q = normalizeText(search);
    return products
      .filter(p => showHidden || !p.hidden)
      .filter(p => !q || p.key.includes(q))
      .sort((a, b) => a.description.localeCompare(b.description, "pt-BR"));
  }, [products, search, showHidden]);

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <PageHeader title="Produtos Salvos" subtitle="Edite o nome, o valor e a categoria usados no preenchimento automático">
        <button onClick={() => setEditTarget("new")} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> Novo Produto
        </button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
        <div className="relative flex-1">
          <input
            className="input pr-8"
            placeholder="Buscar produto"
            aria-label="Buscar produto"
            value={search}
            spellCheck={false}
            onChange={e => setSearch(e.target.value)}
          />
          <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none" />
        </div>
        {hiddenCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>Mostrar ocultos ({hiddenCount})</span>
            <Toggle checked={showHidden} onChange={setShowHidden} />
          </div>
        )}
      </div>

      <div className="card transition-colors">
        {visible.length === 0 ? (
          <div className="text-center py-12">
            <Package size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              {!loaded ? "Carregando..." : search ? "Nenhum produto encontrado" : "Nenhum produto salvo ainda"}
            </p>
          </div>
        ) : (
          <div>
            {visible.map(product => {
              const color = categories.find(c => c.name === product.category)?.color;
              return (
                <div
                  key={product.key}
                  className={`flex items-center gap-3 py-3 border-b border-slate-50 dark:border-slate-700/30 last:border-0 ${
                    product.hidden ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 break-words">
                      {product.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                      {product.category && (
                        <span
                          className="text-[11px] font-medium px-1.5 py-0.5 rounded-full capitalize"
                          style={
                            color
                              ? { backgroundColor: `${color}22`, color }
                              : { backgroundColor: "rgb(239 246 255)", color: "rgb(29 78 216)" }
                          }
                        >
                          {product.category}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {product.count === 0 ? "ainda não usado" : `usado ${product.count}×`}
                      </span>
                    </div>
                  </div>

                  {product.amount > 0 && (
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
                      {formatCurrency(product.amount)}
                    </span>
                  )}

                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditTarget(product)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                      title="Editar"
                      aria-label={`Editar ${product.description}`}
                    >
                      <Pencil size={13} className="text-slate-400 dark:text-slate-500" />
                    </button>
                    <button
                      onClick={() => toggleHidden(product)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                      title={product.hidden ? "Mostrar nas sugestões" : "Ocultar das sugestões"}
                      aria-label={`${product.hidden ? "Mostrar" : "Ocultar"} ${product.description}`}
                    >
                      {product.hidden
                        ? <Eye size={13} className="text-slate-400 dark:text-slate-500" />
                        : <EyeOff size={13} className="text-slate-400 dark:text-slate-500" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
        {visible.length} {visible.length === 1 ? "produto" : "produtos"} · Ocultar tira o produto das sugestões, sem apagar lançamentos.
      </p>

      <ProductEditModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={async () => {
          setEditTarget(null);
          toast("Produto salvo");
          await load();
        }}
        categories={categories}
        products={products}
      />
    </div>
  );
}
