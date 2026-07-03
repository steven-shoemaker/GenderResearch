import { formatPercent } from "./analyze";
import { entryIsStale } from "./utils";
import {
  ALL_CATEGORIES_FILTER,
  entryMatchesCategoryFilter,
  type CategoryFilter,
} from "./categories";
import type { Entry, Lexicon } from "../types";

export interface CorpusStats {
  entryCount: number;
  analyzedCount: number;
  staleCount: number;
  totalWords: number;
  masculinePercent: number | null;
  femininePercent: number | null;
}

/** Word-weighted masculine/feminine % across saved entries in the current archive bucket. */
export function computeCorpusStats(
  entries: Entry[],
  showArchived: boolean,
  lexicon: Lexicon | null,
  categoryFilter: CategoryFilter = ALL_CATEGORIES_FILTER,
): CorpusStats {
  const pool = entries.filter(
    (e) =>
      e.saved &&
      e.archived === showArchived &&
      entryMatchesCategoryFilter(e, categoryFilter),
  );

  let totalWords = 0;
  let masculineCount = 0;
  let feminineCount = 0;
  let analyzedCount = 0;
  let staleCount = 0;

  for (const entry of pool) {
    if (lexicon && entryIsStale(entry, lexicon)) staleCount += 1;
    const analysis = entry.analysis;
    if (!analysis) continue;
    analyzedCount += 1;
    totalWords += analysis.totalWordCount;
    masculineCount += analysis.masculineCount;
    feminineCount += analysis.feminineCount;
  }

  return {
    entryCount: pool.length,
    analyzedCount,
    staleCount,
    totalWords,
    masculinePercent:
      totalWords > 0 ? (masculineCount / totalWords) * 100 : null,
    femininePercent:
      totalWords > 0 ? (feminineCount / totalWords) * 100 : null,
  };
}

export function formatCorpusStats(stats: CorpusStats): {
  entryLabel: string;
  percentLine: string | null;
} {
  const n = stats.entryCount;
  const entryLabel =
    n === 1 ? "1 entry" : `${n.toLocaleString()} entries`;

  if (stats.analyzedCount === 0 || stats.masculinePercent === null) {
    return { entryLabel, percentLine: null };
  }

  const percentLine = `Masculine ${formatPercent(stats.masculinePercent)}% · Feminine ${formatPercent(stats.femininePercent!)}%`;
  return { entryLabel, percentLine };
}
