import { bulkSetEntryCategory } from "./api-client";
import type { Entry } from "../types";

/**
 * Sends just the entry ids + target category — not full entry payloads (bodyText,
 * analysis.matches, attachments, ...). A bulk selection previously round-tripped the
 * complete contents of every selected entry through the CSV-import endpoint just to
 * change one field, which could turn into a multi-megabyte request for a large
 * selection and made "Apply category" feel like it hung.
 */
export async function bulkAssignCategory(
  entries: Entry[],
  entryIds: Iterable<string>,
  categoryId: string | null,
): Promise<{ updated: Entry[]; failed: number }> {
  const idSet = new Set(entryIds);
  if (idSet.size === 0) return { updated: [], failed: 0 };

  const targets = entries.filter((e) => idSet.has(e.id));
  if (targets.length === 0) return { updated: [], failed: 0 };

  try {
    const { updated } = await bulkSetEntryCategory([...idSet], categoryId);
    const now = new Date().toISOString();
    return {
      updated: targets.map((e) => ({ ...e, categoryId, updatedAt: now })),
      failed: Math.max(0, targets.length - updated),
    };
  } catch {
    return { updated: [], failed: targets.length };
  }
}
