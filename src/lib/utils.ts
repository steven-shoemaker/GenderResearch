import type { Entry, Lexicon } from "../types";

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newId(): string {
  return crypto.randomUUID();
}

export function entryIsStale(entry: Entry, lexicon: Lexicon): boolean {
  if (entry.bodyDirty) return true;
  if (!entry.analysis) return true;
  return new Date(lexicon.updatedAt) > new Date(entry.analysis.analyzedAt);
}
