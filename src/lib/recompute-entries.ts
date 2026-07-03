import { saveEntry } from "./api-client";
import { analyzeText } from "./analyze";
import {
  ALL_CATEGORIES_FILTER,
  entryMatchesCategoryFilter,
  type CategoryFilter,
} from "./categories";
import { entryIsStale } from "./utils";
import type { Entry, Lexicon } from "../types";

export function listStaleEntries(
  entries: Entry[],
  lexicon: Lexicon,
  showArchived: boolean,
  categoryFilter: CategoryFilter = ALL_CATEGORIES_FILTER,
): Entry[] {
  return entries.filter(
    (e) =>
      e.saved &&
      e.archived === showArchived &&
      entryMatchesCategoryFilter(e, categoryFilter) &&
      e.bodyText.trim().length > 0 &&
      entryIsStale(e, lexicon),
  );
}

export async function recomputeStaleEntries(
  entries: Entry[],
  lexicon: Lexicon,
  showArchived: boolean,
  onProgress?: (completed: number, total: number) => void,
  categoryFilter: CategoryFilter = ALL_CATEGORIES_FILTER,
): Promise<{ succeeded: Entry[]; failed: number }> {
  const targets = listStaleEntries(entries, lexicon, showArchived, categoryFilter);
  const succeeded: Entry[] = [];
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const entry = targets[i];
    onProgress?.(i + 1, targets.length);
    try {
      const analysis = analyzeText(entry.bodyText, lexicon);
      const saved = await saveEntry({
        ...entry,
        analysis,
        bodyDirty: false,
        updatedAt: new Date().toISOString(),
      });
      succeeded.push(saved);
    } catch {
      failed += 1;
    }
  }

  return { succeeded, failed };
}
