// Shared blob-store + backup/restore logic for every /api route.
// This is the single source of truth: routes import what they need.
// (Underscore-prefixed dir, so Vercel does not treat it as a route.)

const ENTRIES_BLOB = "gender-research/entries.json";
export const ENTRIES_BACKUP_BLOB = "gender-research/entries.backup.json";
const LEXICON_BLOB = "gender-research/lexicon.json";
const CATEGORIES_BLOB = "gender-research/categories.json";
const CATEGORIES_BACKUP_BLOB = "gender-research/categories.backup.json";
const BACKUPS_PREFIX = "gender-research/backups/";
const BACKUP_MANIFEST_BLOB = "gender-research/backups/manifest.json";
const MAX_SNAPSHOTS = 60;

const SEED_MASCULINE = [
  "Active", "Adventurous", "Aggress*", "Ambitio*", "Analy*", "Assert*", "Athlet*",
  "Autonom*", "Boast*", "Challeng*", "Compet*", "Confident", "Courag*", "Decide",
  "Decisive", "Decision*", "Determin*", "Dominant", "Domina*", "Force*", "Greedy",
  "Headstrong", "Hierarch*", "Hostil*", "Implusive", "Independen*", "Individual*",
  "Intellect*", "Lead*", "Logic", "Masculine", "Objective", "Opinion", "Outspoken",
  "Persist", "Principle*", "Reckless", "Stubborn", "Superior", "Self-confiden*",
  "Self-sufficien*", "Self-relian*",
];
const SEED_FEMININE = [
  "Affectionate", "Child*", "Cheer*", "Commit*", "Communal", "Compassion*", "Connect*",
  "Considerate", "Cooperat*", "Depend*", "Emotiona*", "Empath*", "Feminine",
  "Flatterable", "Gentle", "Honest", "Interpersonal", "Interdependen*", "Interpersona*",
  "Kind", "Kinship", "Loyal*", "Modesty", "Nag", "Nurtur*", "Pleasant*", "Polite",
  "Quiet*", "Respon*", "Sensitiv*", "Submissive", "Support*", "Sympath*", "Tender*",
  "Together*", "Trust*", "Understand*", "Warm*", "Whin*", "Yield*",
];

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  size: number;
  url: string;
  pathname?: string;
}

// The store passes entries through untouched; only id/attachments are read here.
export interface Entry {
  id: string;
  attachments: Attachment[];
  updatedAt?: string;
  [key: string]: unknown;
}

export interface Lexicon {
  masculine: string[];
  feminine: string[];
  updatedAt: string;
}

export interface ResearchCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  createdAt: string;
  entryCount: number;
  attachmentCount: number;
  trigger: string;
}

export interface Manifest {
  lastSyncAt: string | null;
  entryCount: number;
  attachmentCount?: number;
  rollingEntryCount?: number;
  snapshots: Snapshot[];
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
}
export function err(m: string, s = 500) {
  return json({ error: m }, s);
}
export function opts() {
  return new Response(null, { status: 204, headers: CORS });
}
export function tok() {
  return process.env.BLOB_READ_WRITE_TOKEN;
}
export function entryIdFromUrl(url: string) {
  const p = new URL(url).pathname.split("/").filter(Boolean);
  const i = p.indexOf("entries");
  return i >= 0 && p[i + 1] ? p[i + 1] : "";
}

// Fallback only when the blob genuinely doesn't exist yet; any read failure throws so
// callers never mistake an outage for an empty store and overwrite real data.
export async function readJson<T>(p: string, fb: T): Promise<T> {
  const { head } = await import("@vercel/blob");
  let meta;
  try {
    meta = await head(p, { token: tok() });
  } catch {
    return fb;
  }
  const v = new Date(meta.uploadedAt).getTime();
  const urls = [meta.downloadUrl, meta.url].filter(Boolean) as string[];
  let lastStatus = 0;
  for (const u of urls) {
    const r = await fetch(u + (u.includes("?") ? "&" : "?") + "v=" + v, { cache: "no-store" });
    if (r.ok) return r.json() as Promise<T>;
    lastStatus = r.status;
  }
  throw new Error("Failed to read " + p + " (HTTP " + lastStatus + ")");
}
async function writeJson(p: string, d: unknown) {
  const { put } = await import("@vercel/blob");
  await put(p, JSON.stringify(d), {
    access: "public", addRandomSuffix: false, allowOverwrite: true,
    contentType: "application/json", cacheControlMaxAge: 60, token: tok(),
  });
}

export async function getEntries(): Promise<Entry[]> {
  return readJson<Entry[]>(ENTRIES_BLOB, []);
}
export async function getEntry(id: string): Promise<Entry | undefined> {
  return (await getEntries()).find((e) => e.id === id);
}
export async function upsertEntry(e: Entry): Promise<Entry> {
  const all = await getEntries();
  if (all.length) await writeJson(ENTRIES_BACKUP_BLOB, all);
  const i = all.findIndex((x) => x.id === e.id);
  if (i >= 0) all[i] = e;
  else all.push(e);
  await writeJson(ENTRIES_BLOB, all);
  return e;
}
/** Merge many entries in one read/write so bulk import cannot lose rows to stale reads. */
export async function upsertEntries(incoming: Entry[]): Promise<{ added: number; total: number }> {
  if (!incoming.length) return { added: 0, total: (await getEntries()).length };
  const all = await getEntries();
  if (all.length) await writeJson(ENTRIES_BACKUP_BLOB, all);
  const byId = new Map(all.map((e) => [e.id, e]));
  let added = 0;
  for (const e of incoming) {
    if (!byId.has(e.id)) added++;
    byId.set(e.id, e);
  }
  const merged = [...byId.values()];
  await writeJson(ENTRIES_BLOB, merged);
  return { added, total: merged.length };
}
export async function deleteEntry(id: string) {
  const all = await getEntries();
  await writeJson(ENTRIES_BLOB, all.filter((e) => e.id !== id));
}
/**
 * Patches only categoryId (+ updatedAt) on the given ids, reading the current stored
 * entries fresh rather than requiring the client to round-trip full entry payloads
 * (bodyText, analysis.matches, attachments, ...) just to move entries between categories.
 */
export async function bulkSetEntryCategory(
  ids: string[],
  categoryId: string | null,
): Promise<{ updated: number }> {
  if (!ids.length) return { updated: 0 };
  const idSet = new Set(ids);
  const all = await getEntries();
  if (all.length) await writeJson(ENTRIES_BACKUP_BLOB, all);
  const now = new Date().toISOString();
  let updated = 0;
  const next = all.map((e) => {
    if (!idSet.has(e.id)) return e;
    updated++;
    return { ...e, categoryId, updatedAt: now };
  });
  if (updated > 0) await writeJson(ENTRIES_BLOB, next);
  return { updated };
}

function defaultLexicon(): Lexicon {
  return {
    masculine: [...SEED_MASCULINE],
    feminine: [...SEED_FEMININE],
    updatedAt: new Date().toISOString(),
  };
}

export async function getLexicon(): Promise<Lexicon> {
  try {
    return (await readJson<Lexicon | null>(LEXICON_BLOB, null)) ?? defaultLexicon();
  } catch {
    // Lexicon read failures must not take down the app; seed list is safe to use.
    return defaultLexicon();
  }
}
export async function saveLexicon(l: Lexicon): Promise<Lexicon> {
  const n = { ...l, updatedAt: new Date().toISOString() };
  await writeJson(LEXICON_BLOB, n);
  return n;
}

function defaultCategories(): ResearchCategory[] {
  return [
    {
      id: "sustainability",
      name: "Sustainability",
      createdAt: new Date().toISOString(),
    },
  ];
}

export async function getCategories(): Promise<ResearchCategory[]> {
  try {
    // `null` means the blob has never been written (fresh install); an explicit `[]`
    // means the user deleted every category, which must stick rather than reseed.
    const stored = await readJson<ResearchCategory[] | null>(CATEGORIES_BLOB, null);
    return stored ?? defaultCategories();
  } catch {
    return defaultCategories();
  }
}

export async function saveCategories(categories: ResearchCategory[]): Promise<ResearchCategory[]> {
  // Back up the previous list before overwrite, same pattern as upsertEntry, so an
  // accidental save (e.g. dropping a category) can be recovered from the rolling copy.
  try {
    const previous = await getCategories();
    if (previous.length) await writeJson(CATEGORIES_BACKUP_BLOB, previous);
  } catch {
    // Missing/unreadable previous categories should not block saving new ones.
  }
  const normalized = categories.map((c) => ({
    id: c.id.trim(),
    name: c.name.trim(),
    createdAt: c.createdAt || new Date().toISOString(),
  }));
  await writeJson(CATEGORIES_BLOB, normalized);
  return normalized;
}

export function categoryIdFromUrl(url: string) {
  const p = new URL(url).pathname.split("/").filter(Boolean);
  const i = p.indexOf("categories");
  return i >= 0 && p[i + 1] ? decodeURIComponent(p[i + 1]) : "";
}

export async function renameCategory(id: string, name: string): Promise<ResearchCategory[]> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name cannot be empty");
  const categories = await getCategories();
  if (!categories.some((c) => c.id === id)) throw new Error("Category not found");
  const duplicate = categories.find(
    (c) => c.id !== id && c.name.localeCompare(trimmed, undefined, { sensitivity: "base" }) === 0,
  );
  if (duplicate) throw new Error(`Category "${duplicate.name}" already exists`);
  const updated = categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
  return saveCategories(updated);
}

/** Deletes a category, reassigning any entries that used it to `reassignTo` (or null/uncategorized). */
export async function deleteCategory(
  id: string,
  reassignTo: string | null,
): Promise<{ reassignedCount: number; categories: ResearchCategory[] }> {
  const categories = await getCategories();
  if (!categories.some((c) => c.id === id)) throw new Error("Category not found");
  if (reassignTo && !categories.some((c) => c.id === reassignTo)) {
    throw new Error("Reassignment category not found");
  }
  // Reassign entries first: if the category-list write below fails, entries are already
  // safely off the doomed category rather than left pointing at a category about to vanish.
  const entries = await getEntries();
  const affected = entries.filter((e) => e.categoryId === id);
  if (affected.length) {
    const now = new Date().toISOString();
    const updated = affected.map((e) => ({ ...e, categoryId: reassignTo, updatedAt: now }));
    await upsertEntries(updated);
  }
  const remaining = categories.filter((c) => c.id !== id);
  const saved = await saveCategories(remaining);
  return { reassignedCount: affected.length, categories: saved };
}

export function attachPath(eid: string, aid: string, fn: string) {
  return `gender-research/attachments/${eid}/${aid}-${fn.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}
export async function delEntryAttachments(eid: string) {
  const { list, del } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: `gender-research/attachments/${eid}/`, token: tok() });
  await Promise.all(blobs.map((b) => del(b.url, { token: tok() })));
}

function snapshotStamp(d?: Date) {
  const x = d ?? new Date();
  return x.toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
}
export async function readManifest(): Promise<Manifest> {
  return (await readJson<Manifest | null>(BACKUP_MANIFEST_BLOB, null)) ?? {
    lastSyncAt: null, entryCount: 0, snapshots: [],
  };
}
async function deleteBlobPath(pathname: string) {
  const { list, del } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: pathname, limit: 1, token: tok() });
  const m = blobs.find((b) => b.pathname === pathname);
  if (m?.url) await del(m.url, { token: tok() });
}
function attachmentBackupPath(stamp: string, eid: string, aid: string, fn: string) {
  return BACKUPS_PREFIX + stamp + "/attachments/" + eid + "/" + aid + "-" + fn.replace(/[^a-zA-Z0-9._-]/g, "_");
}
async function copyBlobFromUrl(sourceUrl: string, destPathname: string, contentType?: string) {
  const r = await fetch(sourceUrl, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch blob (HTTP " + r.status + ")");
  const buf = await r.arrayBuffer();
  const { put } = await import("@vercel/blob");
  const blob = await put(destPathname, buf, {
    access: "public", addRandomSuffix: false, allowOverwrite: true,
    contentType: contentType || "application/octet-stream", token: tok(),
  });
  return { url: blob.url, pathname: blob.pathname };
}
async function deleteBackupAttachmentTree(stamp: string) {
  const { list, del } = await import("@vercel/blob");
  const prefix = BACKUPS_PREFIX + stamp + "/attachments/";
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token: tok(), cursor });
    await Promise.all(page.blobs.map((b) => del(b.url, { token: tok() })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}
async function backupAttachments(stamp: string, entries: Entry[]) {
  let attachmentCount = 0;
  for (const entry of entries) {
    const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
    for (const a of attachments) {
      if (!a?.url || !a.id || !a.fileName) continue;
      const dest = attachmentBackupPath(stamp, entry.id, a.id, a.fileName);
      await copyBlobFromUrl(a.url, dest, a.mimeType || "application/pdf");
      attachmentCount++;
    }
  }
  return attachmentCount;
}
async function restoreAttachments(stamp: string, entries: Entry[]) {
  let attachmentCount = 0;
  const restored: Entry[] = [];
  for (const entry of entries) {
    const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
    const nextAttachments: Attachment[] = [];
    for (const a of attachments) {
      if (!a?.id || !a.fileName) { nextAttachments.push(a); continue; }
      const backupPath = attachmentBackupPath(stamp, entry.id, a.id, a.fileName);
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: backupPath, limit: 1, token: tok() });
      const backup = blobs.find((b) => b.pathname === backupPath);
      if (!backup?.url) { nextAttachments.push(a); continue; }
      const livePath = attachPath(entry.id, a.id, a.fileName);
      const copied = await copyBlobFromUrl(backup.url, livePath, a.mimeType || "application/pdf");
      nextAttachments.push({ ...a, url: copied.url, pathname: copied.pathname });
      attachmentCount++;
    }
    restored.push({ ...entry, attachments: nextAttachments });
  }
  return { entries: restored, attachmentCount };
}

export async function syncEntriesBackup(trigger?: string): Promise<Manifest> {
  const entries = await getEntries();
  const lexicon = await getLexicon();
  const categories = await getCategories();
  const now = new Date();
  const stamp = snapshotStamp(now);
  const entriesSnapshot = BACKUPS_PREFIX + "entries-" + stamp + ".json";
  const lexiconSnapshot = BACKUPS_PREFIX + "lexicon-" + stamp + ".json";
  const categoriesSnapshot = BACKUPS_PREFIX + "categories-" + stamp + ".json";
  if (entries.length) {
    await writeJson(ENTRIES_BACKUP_BLOB, entries);
    await writeJson(entriesSnapshot, entries);
  }
  await writeJson(lexiconSnapshot, lexicon);
  await writeJson(categoriesSnapshot, categories);
  let attachmentCount = 0;
  if (entries.length) {
    attachmentCount = await backupAttachments("rolling", entries);
    await backupAttachments(stamp, entries);
  }
  const manifest = await readManifest();
  const snapshots = Array.isArray(manifest.snapshots) ? manifest.snapshots : [];
  snapshots.unshift({
    id: stamp,
    createdAt: now.toISOString(),
    entryCount: entries.length,
    attachmentCount,
    trigger: trigger || "manual",
  });
  // snapshots is newest-first: keep the newest MAX_SNAPSHOTS, delete the overflow.
  const kept = snapshots.slice(0, MAX_SNAPSHOTS);
  const overflow = snapshots.slice(MAX_SNAPSHOTS);
  for (const s of overflow) {
    await deleteBlobPath(BACKUPS_PREFIX + "entries-" + s.id + ".json");
    await deleteBlobPath(BACKUPS_PREFIX + "lexicon-" + s.id + ".json");
    await deleteBlobPath(BACKUPS_PREFIX + "categories-" + s.id + ".json");
    await deleteBackupAttachmentTree(s.id);
  }
  const next: Manifest = {
    lastSyncAt: now.toISOString(),
    entryCount: entries.length,
    attachmentCount,
    rollingEntryCount: entries.length,
    snapshots: kept,
  };
  await writeJson(BACKUP_MANIFEST_BLOB, next);
  return next;
}

export async function restoreEntries(source: string) {
  let entries: Entry[] | null = null;
  let stamp = source;
  if (source === "rolling") {
    entries = await readJson<Entry[] | null>(ENTRIES_BACKUP_BLOB, null);
    stamp = "rolling";
  } else {
    const manifest = await readManifest();
    const snap = source === "latest" ? manifest.snapshots?.[0] : (manifest.snapshots || []).find((s) => s.id === source);
    if (!snap) throw new Error("Backup snapshot not found");
    entries = await readJson<Entry[] | null>(BACKUPS_PREFIX + "entries-" + snap.id + ".json", null);
    stamp = snap.id;
  }
  if (!Array.isArray(entries)) throw new Error("Backup is empty or unreadable");
  if (!entries.length) throw new Error("Backup contains no entries");
  const { entries: withAttachments, attachmentCount } = await restoreAttachments(stamp, entries);
  await writeJson(ENTRIES_BLOB, withAttachments);
  return { restored: withAttachments.length, attachments: attachmentCount, source: stamp };
}

export function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  return req.headers.get("authorization") === "Bearer " + secret;
}
