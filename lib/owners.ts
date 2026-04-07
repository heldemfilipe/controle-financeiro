export interface Owner {
  /** Slug usado no banco (ex: "heldem", "vitoria", "casal") */
  id: string;
  /** Nome de exibição (ex: "Heldem", "Vitoria", "Família") */
  name: string;
  /** Cor hex (ex: "#6366f1") */
  color: string;
}

const OWNERS_KEY = "app_owners";

export const DEFAULT_OWNERS: Owner[] = [
  { id: "heldem",  name: "Heldem",  color: "#6366f1" },
  { id: "vitoria", name: "Vitoria", color: "#ec4899" },
  { id: "casal",   name: "Família", color: "#10b981" },
];

export function getOwners(): Owner[] {
  if (typeof window === "undefined") return DEFAULT_OWNERS;
  try {
    const raw = localStorage.getItem(OWNERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Owner[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_OWNERS;
}

export function saveOwners(owners: Owner[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(OWNERS_KEY, JSON.stringify(owners));
  }
}

export function getOwnerById(id: string): Owner | undefined {
  return getOwners().find(o => o.id === id);
}

/**
 * Converte um nome em slug para usar como ID no banco.
 * Ex: "João Silva" → "joao_silva"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}
