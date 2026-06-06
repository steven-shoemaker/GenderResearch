import type { AttachmentMeta, Entry, ImportJobListing, Lexicon } from "../types";

export interface JobSearchParams {
  title?: string;
  industry?: string;
  location?: string;
  limit?: number;
  offset?: number;
  feed?: "ats" | "jb";
  timeFrame?: "1h" | "24h" | "7d" | "6m";
}

export interface JobSearchResponse {
  jobs: ImportJobListing[];
  feed: string;
  count: number;
  offset: number;
  limit: number;
  upstreamCount: number;
  skippedWithoutDescription: number;
  hasMore: boolean;
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
