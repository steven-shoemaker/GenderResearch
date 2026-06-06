import { formatPercent } from "./analyze";
import { entryTitle } from "./entries";
import { entryIsStale } from "./utils";
import type { Entry, Lexicon } from "../types";

const COLUMNS = [
  "title",
  "company",
  "source_url",
  "captured_date",
  "industry",
  "salary_gbp",
  "notes",
  "word_count",
  "masculine_count",
  "feminine_count",
  "masculine_percent",
  "feminine_percent",
  "analyzed_at",
  "scores_outdated",
  "archived",
  "entry_id",
  "app_link",
] as const;

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return escapeCsvCell(String(value));
}

function entryAppLink(entryId: string): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/entry/${entryId}`;
  }
  return `/entry/${entryId}`;
}

export function entriesToCsv(
  entries: Entry[],
  lexicon: Lexicon | null,
): string {
  const saved = entries
    .filter((e) => e.saved)
    .sort(
      (a, b) =>
        new Date(b.capturedDate).getTime() - new Date(a.capturedDate).getTime(),
    );

  const header = COLUMNS.join(",");
  const rows = saved.map((entry) => {
    const a = entry.analysis;
    const displayTitle = entry.title.trim() || entryTitle(entry);
    return [
      cell(displayTitle),
      cell(entry.company),
      cell(entry.sourceUrl),
      cell(entry.capturedDate),
      cell(entry.industry),
      cell(entry.salaryGbp ?? ""),
      cell(entry.notes),
      cell(a?.totalWordCount ?? ""),
      cell(a?.masculineCount ?? ""),
      cell(a?.feminineCount ?? ""),
      cell(a ? formatPercent(a.masculinePercent) : ""),
      cell(a ? formatPercent(a.femininePercent) : ""),
      cell(a?.analyzedAt ?? ""),
      cell(lexicon && a ? entryIsStale(entry, lexicon) : ""),
      cell(entry.archived),
      cell(entry.id),
      cell(entryAppLink(entry.id)),
    ].join(",");
  });

  return [header, ...rows].join("\r\n");
}

export function downloadCsvFile(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportEntriesCsv(
  entries: Entry[],
  lexicon: Lexicon | null,
  options?: { archivedOnly?: boolean },
): void {
  const pool = entries.filter(
    (e) => e.saved && e.archived === Boolean(options?.archivedOnly),
  );
  if (pool.length === 0) return;

  const csv = entriesToCsv(pool, lexicon);
  const date = new Date().toISOString().slice(0, 10);
  const suffix = options?.archivedOnly ? "archived" : "entries";
  downloadCsvFile(`gender-research-${suffix}-${date}.csv`, csv);
}
