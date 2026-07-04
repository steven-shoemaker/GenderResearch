import type { AttachmentMeta, Entry, ImportJobListing, Lexicon, ResearchCategory } from "../types";

export type JobSearchTimeFrame = "24h" | "7d" | "6m";

export interface JobSearchParams {
  title?: string;
  industry?: string;
  location?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
  feed?: "ats" | "jb";
  timeFrame?: JobSearchTimeFrame;
}

export interface JobSearchResponse {
  jobs: ImportJobListing[];
  feed: string;
  count: number;
  offset: number;
  limit: number;
  timeFrame: string;
  upstreamCount: number;
  skippedWithoutDescription: number;
  hasMore: boolean;
  nextCursor: string | null;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Bounds every request so a slow/hung function surfaces as an error instead of a stuck spinner. */
async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, { ...init, signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        typeof body === "object" && body && "error" in body
          ? String((body as { error: string }).error)
          : `Request failed (${res.status})`;
      throw new Error(message);
    }
    return body as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchEntries(): Promise<Entry[]> {
  return request<Entry[]>("/api/entries");
}

export async function fetchEntry(id: string): Promise<Entry> {
  return request<Entry>(`/api/entries/${id}`);
}

export async function saveEntry(entry: Entry): Promise<Entry> {
  return request<Entry>(`/api/entries/${entry.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}

export async function importEntries(
  entries: Entry[],
): Promise<{ added: number; total: number }> {
  return request<{ added: number; total: number }>(
    "/api/entries/import",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entries),
    },
    60_000,
  );
}

/** Patches only categoryId across many entries in one request — no need to round-trip full entries. */
export async function bulkSetEntryCategory(
  entryIds: string[],
  categoryId: string | null,
): Promise<{ updated: number }> {
  return request<{ updated: number }>("/api/entries/bulk-category", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryIds, categoryId }),
  });
}

export async function removeEntry(id: string): Promise<void> {
  await request(`/api/entries/${id}`, { method: "DELETE" });
}

export async function fetchLexicon(): Promise<Lexicon> {
  return request<Lexicon>("/api/lexicon");
}

export async function saveLexicon(lexicon: Lexicon): Promise<Lexicon> {
  return request<Lexicon>("/api/lexicon", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lexicon),
  });
}

export async function fetchCategories(): Promise<ResearchCategory[]> {
  return request<ResearchCategory[]>("/api/categories");
}

export async function saveCategories(
  categories: ResearchCategory[],
): Promise<ResearchCategory[]> {
  return request<ResearchCategory[]>("/api/categories", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(categories),
  });
}

export async function renameCategory(
  id: string,
  name: string,
): Promise<ResearchCategory[]> {
  return request<ResearchCategory[]>(`/api/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export interface DeleteCategoryResult {
  deleted: boolean;
  reassignedCount: number;
  categories: ResearchCategory[];
}

export async function deleteCategory(
  id: string,
  reassignTo: string | null,
): Promise<DeleteCategoryResult> {
  const query = reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : "";
  return request<DeleteCategoryResult>(
    `/api/categories/${encodeURIComponent(id)}${query}`,
    { method: "DELETE" },
  );
}

export async function uploadAttachment(
  entryId: string,
  file: File,
): Promise<AttachmentMeta> {
  const form = new FormData();
  form.append("file", file);
  return request<AttachmentMeta>(
    `/api/entries/${entryId}/attachments`,
    { method: "POST", body: form },
    120_000,
  );
}

export async function searchImportJobs(
  params: JobSearchParams,
): Promise<JobSearchResponse> {
  const q = new URLSearchParams();
  if (params.title) q.set("title", params.title);
  if (params.industry) q.set("industry", params.industry);
  if (params.location) q.set("location", params.location);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.feed) q.set("feed", params.feed);
  if (params.timeFrame) q.set("time_frame", params.timeFrame);
  return request<JobSearchResponse>(`/api/jobs/search?${q}`);
}

export async function deleteAttachment(
  entryId: string,
  attachmentId: string,
): Promise<void> {
  await request(
    `/api/entries/${entryId}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  );
}

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  entryCount: number;
  attachmentCount?: number;
  trigger: string;
}

export interface BackupStatus {
  lastSyncAt: string | null;
  entryCount: number;
  attachmentCount?: number;
  rollingEntryCount: number;
  snapshots: BackupSnapshot[];
}

export async function fetchBackupStatus(): Promise<BackupStatus> {
  return request<BackupStatus>("/api/entries/backup");
}

export async function syncEntriesBackup(): Promise<BackupStatus> {
  return request<BackupStatus>("/api/entries/backup", { method: "POST" }, 120_000);
}

export async function restoreEntriesBackup(
  source: "latest" | "rolling" = "latest",
): Promise<{ restored: number; attachments: number; source: string }> {
  return request<{ restored: number; attachments: number; source: string }>(
    "/api/entries/restore",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    },
    120_000,
  );
}
