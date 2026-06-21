import { analyzeText } from "./analyze";
import { normalizeEntry } from "./entries";
import { CSV_IMPORT_COLUMNS } from "./export-csv";
import { parseSalaryGbp } from "./salary";
import { newId, todayIsoDate } from "./utils";
import type { Entry, Lexicon } from "../types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CsvImportResult {
  imported: Entry[];
  skipped: number;
  errors: string[];
}

/** Parse RFC-style CSV (quoted fields, embedded commas and newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r") {
      if (src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
    } else if (ch === "\n") {
      row.push(cell);
      cell = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function parseArchived(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === "yes" || v === "true" || v === "1";
}

function rowRecord(headers: string[], values: string[]): Record<string, string> {
  const rec: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    rec[headers[i]] = values[i] ?? "";
  }
  return rec;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function validateHeaders(headers: string[]): string | null {
  const normalized = headers.map(normalizeHeader);
  const required = CSV_IMPORT_COLUMNS.map((c) => c.toLowerCase());
  for (const col of required) {
    if (!normalized.includes(col)) {
      return `Missing column "${col}". Expected: ${CSV_IMPORT_COLUMNS.join(", ")}`;
    }
  }
  return null;
}

function entryIdFromRow(raw: string, used: Set<string>, existing: Set<string>): string {
  const id = raw.trim();
  if (UUID_RE.test(id) && !used.has(id) && !existing.has(id)) return id;
  return newId();
}

export function csvRowsToEntries(
  rows: string[][],
  lexicon: Lexicon,
  existingEntryIds: Set<string>,
): CsvImportResult {
  const errors: string[] = [];
  const imported: Entry[] = [];
  let skipped = 0;

  if (rows.length < 2) {
    return { imported, skipped, errors: ["CSV has no data rows."] };
  }

  const headers = rows[0].map(normalizeHeader);
  const headerError = validateHeaders(rows[0]);
  if (headerError) return { imported, skipped, errors: [headerError] };

  const usedIds = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;
    const rec = rowRecord(headers, rows[r]);
    const description = (rec.description ?? "").trim();
    if (!description) {
      skipped++;
      errors.push(`Row ${line}: skipped — empty description.`);
      continue;
    }

    const rawId = (rec.entry_id ?? "").trim();
    if (rawId && existingEntryIds.has(rawId)) {
      skipped++;
      errors.push(`Row ${line}: skipped — entry_id already exists (${rawId}).`);
      continue;
    }
    if (rawId && usedIds.has(rawId)) {
      skipped++;
      errors.push(`Row ${line}: skipped — duplicate entry_id in file (${rawId}).`);
      continue;
    }

    const id = entryIdFromRow(rawId, usedIds, existingEntryIds);
    usedIds.add(id);

    const captured = (rec.captured_date ?? "").trim() || todayIsoDate();
    const now = new Date().toISOString();
    const analysis = analyzeText(description, lexicon);

    imported.push(
      normalizeEntry({
        id,
        saved: true,
        bodyText: description,
        title: (rec.title ?? "").trim(),
        company: (rec.company ?? "").trim(),
        sourceUrl: (rec.source_url ?? "").trim(),
        capturedDate: captured,
        industry: (rec.industry ?? "").trim(),
        externalJobId: null,
        importSource: "csv",
        salaryGbp: parseSalaryGbp(rec.salary_gbp ?? ""),
        notes: (rec.notes ?? "").trim(),
        analysis,
        bodyDirty: false,
        attachments: [],
        archived: parseArchived(rec.archived ?? ""),
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  return { imported, skipped, errors };
}

export function parseEntriesCsv(
  csvText: string,
  lexicon: Lexicon,
  existingEntryIds: Set<string>,
): CsvImportResult {
  return csvRowsToEntries(parseCsv(csvText), lexicon, existingEntryIds);
}
