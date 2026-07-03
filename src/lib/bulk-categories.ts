import { importEntries } from "./api-client";
import type { Entry } from "../types";

export async function bulkAssignCategory(
  entries: Entry[],
  entryIds: Iterable<string>,
  categoryId: string | null,
): Promise<{ updated: Entry[]; failed: number }> {
  const ids = new Set(entryIds);
  if (ids.size === 0) return { updated: [], failed: 0 };

  const now = new Date().toISOString();
  const toSave = entries
    .filter((e) => ids.has(e.id))
    .map((e) => ({ ...e, categoryId, updatedAt: now }));

  if (toSave.length === 0) return { updated: [], failed: 0 };

  try {
    await importEntries(toSave);
    return { updated: toSave, failed: 0 };
  } catch {
    return { updated: [], failed: toSave.length };
  }
}
