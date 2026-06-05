import type { Entry } from "../types";
import { newId, todayIsoDate } from "./utils";

export function normalizeEntry(entry: Entry): Entry {
  return { ...entry, salaryGbp: entry.salaryGbp ?? null };
}

export function createPreviewEntry(): Entry {
  const now = new Date().toISOString();
  return {
    id: newId(),
    saved: false,
    bodyText: "",
    title: "",
    company: "",
    sourceUrl: "",
    capturedDate: todayIsoDate(),
    salaryGbp: null,
    notes: "",
    analysis: null,
    bodyDirty: false,
    attachments: [],
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function entryTitle(entry: Entry): string {
  if (entry.title.trim()) return entry.title.trim();
  const first = entry.bodyText.trim().split(/\n/)[0]?.trim();
  if (first) return first.length > 80 ? `${first.slice(0, 80)}…` : first;
  return "Untitled entry";
}
