"use client";

import type { Category } from "@/types";

interface CategoryBadgeProps {
  category: string | null | undefined;
  categories: Category[];
  size?: "sm" | "md";
  fallback?: string;
}

export function CategoryBadge({ category, categories, size = "md", fallback }: CategoryBadgeProps) {
  const catObj = categories.find(c => c.name === category);
  const color = catObj?.color;
  const label = category
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : fallback;
  if (!label) return null;
  const padding = size === "sm" ? "px-1.5" : "px-2";
  return (
    <span
      className={`text-xs font-medium ${padding} py-0.5 rounded-full`}
      style={color
        ? { backgroundColor: `${color}22`, color }
        : { backgroundColor: "rgb(239 246 255)", color: "rgb(29 78 216)" }}
    >
      {label}
    </span>
  );
}
