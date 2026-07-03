import type { Entry, ResearchCategory } from "../types";

export const ALL_CATEGORIES_FILTER = "all";
export const UNCategorized_FILTER = "uncategorized";

export type CategoryFilter =
  | typeof ALL_CATEGORIES_FILTER
  | typeof UNCategorized_FILTER
  | string;

export function categorySlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "category";
}

export function uniqueCategoryId(name: string, existing: ResearchCategory[]): string {
  const base = categorySlug(name);
  const ids = new Set(existing.map((c) => c.id));
  if (!ids.has(base)) return base;
  let n = 2;
  while (ids.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function categoryNameById(
  categories: ResearchCategory[],
  categoryId: string | null | undefined,
): string {
  if (!categoryId) return "Uncategorized";
  return categories.find((c) => c.id === categoryId)?.name ?? "Uncategorized";
}

export function entryMatchesCategoryFilter(
  entry: Entry,
  filter: CategoryFilter,
): boolean {
  if (filter === ALL_CATEGORIES_FILTER) return true;
  if (filter === UNCategorized_FILTER) return !entry.categoryId;
  return entry.categoryId === filter;
}

export function sortCategories(categories: ResearchCategory[]): ResearchCategory[] {
  return [...categories].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}
