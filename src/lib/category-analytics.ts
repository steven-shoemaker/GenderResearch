import { computeCorpusStats, type CorpusStats } from "./corpus-stats";
import { sortCategories, UNCATEGORIZED_FILTER } from "./categories";
import type { Entry, Lexicon, ResearchCategory } from "../types";

export interface CategoryAnalyticsRow {
  id: string;
  name: string;
  isUncategorized: boolean;
  stats: CorpusStats;
}

export type CategorySortKey = "entries" | "masculine" | "feminine" | "name";

export const CATEGORY_SORT_OPTIONS: { value: CategorySortKey; label: string }[] = [
  { value: "entries", label: "Most entries" },
  { value: "masculine", label: "Highest masculine %" },
  { value: "feminine", label: "Highest feminine %" },
  { value: "name", label: "Name (A–Z)" },
];

/** One stats row per category (plus Uncategorized, if it has any entries) for side-by-side comparison. */
export function computeCategoryAnalytics(
  entries: Entry[],
  categories: ResearchCategory[],
  showArchived: boolean,
  lexicon: Lexicon | null,
): CategoryAnalyticsRow[] {
  const rows: CategoryAnalyticsRow[] = sortCategories(categories).map((c) => ({
    id: c.id,
    name: c.name,
    isUncategorized: false,
    stats: computeCorpusStats(entries, showArchived, lexicon, c.id),
  }));

  const uncategorizedStats = computeCorpusStats(
    entries,
    showArchived,
    lexicon,
    UNCATEGORIZED_FILTER,
  );
  if (uncategorizedStats.entryCount > 0) {
    rows.push({
      id: UNCATEGORIZED_FILTER,
      name: "Uncategorized",
      isUncategorized: true,
      stats: uncategorizedStats,
    });
  }

  return rows;
}

export function sortCategoryAnalytics(
  rows: CategoryAnalyticsRow[],
  sortKey: CategorySortKey,
): CategoryAnalyticsRow[] {
  const sorted = [...rows];
  switch (sortKey) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    case "entries":
      return sorted.sort((a, b) => b.stats.entryCount - a.stats.entryCount);
    case "masculine":
      return sorted.sort(
        (a, b) => (b.stats.masculinePercent ?? -1) - (a.stats.masculinePercent ?? -1),
      );
    case "feminine":
      return sorted.sort(
        (a, b) => (b.stats.femininePercent ?? -1) - (a.stats.femininePercent ?? -1),
      );
    default: {
      const exhaustive: never = sortKey;
      return exhaustive;
    }
  }
}
