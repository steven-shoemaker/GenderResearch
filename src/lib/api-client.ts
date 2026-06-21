import type { AttachmentMeta, Entry, ImportJobListing, Lexicon } from "../types";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: string }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
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
  return request<{ added: number; total: number }>("/api/entries/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
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

export async function uploadAttachment(
  entryId: string,
  file: File,
): Promise<AttachmentMeta> {
  const form = new FormData();
  form.append("file", file);
  return request<AttachmentMeta>(`/api/entries/${entryId}/attachments`, {
    method: "POST",
    body: form,
  });
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
  return request<BackupStatus>("/api/entries/backup", { method: "POST" });
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
  );
}
