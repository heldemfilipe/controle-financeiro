"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { getCategories, upsertCategory, deleteCategory } from "@/lib/queries";
import type { Category } from "@/types";

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [modal, setModal] = useState(false);
  const [editCat, setEditCat] = useState<Partial<Category>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const cats = await getCategories();
    setCategories(cats);
  }

  function openNew() {
    setEditCat({ color: "#6366f1", active: true });
    setModal(true);
  }

  function openEdit(cat: Category) {
    setEditCat(cat);
    setModal(true);
  }

  async function save() {
    if (!editCat.name) return;
    setLoading(true);
    await upsertCategory({ color: "#6366f1", active: true, ...editCat });
    setModal(false);
    setEditCat({});
    await load();
    setLoading(false);
  }

  async function remove(id: string) {
    if (!confirm("Remover esta categoria? As contas e lançamentos mantêm o nome.")) return;
    await deleteCategory(id);
    await load();
  }

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <PageHeader title="Categorias" subtitle="Gerencie as categorias de contas e lançamentos">
        <button
          onClick={openNew}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus size={14} /> Nova Categoria
        </button>
      </PageHeader>

      <div className="card transition-colors">
        {categories.length === 0 ? (
          <div className="text-center py-12">
            <Tag size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-slate-500 text-sm">Nenhuma categoria cadastrada</p>
            <button onClick={openNew} className="btn-primary mt-4 text-sm">
              Criar primeira categoria
            </button>
          </div>
        ) : (
          <div className="space-y-0">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-700/30 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {/* Bolinha colorida */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${cat.color}22` }}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                      {cat.color}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Badge de prévia */}
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full hidden sm:inline-flex"
                    style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
                  >
                    {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                  </span>

                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(cat)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                      title="Editar"
                    >
                      <Pencil size={13} className="text-slate-400 dark:text-slate-500" />
                    </button>
                    <button
                      onClick={() => remove(cat.id)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      title="Remover"
                    >
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
        {categories.length} {categories.length === 1 ? "categoria cadastrada" : "categorias cadastradas"} · As categorias são usadas em Contas Fixas e Lançamentos de Cartão.
      </p>

      {/* Modal */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); setEditCat({}); }}
        title={editCat.id ? "Editar Categoria" : "Nova Categoria"}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input
              className="input"
              placeholder="Ex: Lazer, Saúde, Alimentação…"
              value={editCat.name ?? ""}
              onChange={e => setEditCat(p => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Cor</label>
            <div className="flex items-center gap-3">
              <input
                className="h-11 w-16 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer p-1"
                type="color"
                value={editCat.color ?? "#6366f1"}
                onChange={e => setEditCat(p => ({ ...p, color: e.target.value }))}
              />
              {/* Prévia do badge */}
              <div className="flex-1 flex items-center gap-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5">
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: editCat.color ?? "#6366f1" }}
                />
                <span
                  className="text-sm font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${editCat.color ?? "#6366f1"}22`,
                    color: editCat.color ?? "#6366f1",
                  }}
                >
                  {editCat.name
                    ? editCat.name.charAt(0).toUpperCase() + editCat.name.slice(1)
                    : "Prévia"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setModal(false); setEditCat({}); }}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button onClick={save} disabled={loading} className="btn-primary flex-1">
              Salvar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
