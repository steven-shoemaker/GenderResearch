import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const STORE = `
const ENTRIES_BLOB = "gender-research/entries.json";
const ENTRIES_BACKUP_BLOB = "gender-research/entries.backup.json";
const LEXICON_BLOB = "gender-research/lexicon.json";
const BACKUPS_PREFIX = "gender-research/backups/";
const BACKUP_MANIFEST_BLOB = "gender-research/backups/manifest.json";
const MAX_SNAPSHOTS = 60;
const SEED_MASCULINE = ${JSON.stringify([
  "Active", "Adventurous", "Aggress*", "Ambitio*", "Analy*", "Assert*", "Athlet*",
  "Autonom*", "Boast*", "Challeng*", "Compet*", "Confident", "Courag*", "Decide",
  "Decisive", "Decision*", "Determin*", "Dominant", "Domina*", "Force*", "Greedy",
  "Headstrong", "Hierarch*", "Hostil*", "Implusive", "Independen*", "Individual*",
  "Intellect*", "Lead*", "Logic", "Masculine", "Objective", "Opinion", "Outspoken",
  "Persist", "Principle*", "Reckless", "Stubborn", "Superior", "Self-confiden*",
  "Self-sufficien*", "Self-relian*",
])};
const SEED_FEMININE = ${JSON.stringify([
  "Affectionate", "Child*", "Cheer*", "Commit*", "Communal", "Compassion*", "Connect*",
  "Considerate", "Cooperat*", "Depend*", "Emotiona*", "Empath*", "Feminine",
  "Flatterable", "Gentle", "Honest", "Interpersonal", "Interdependen*", "Interpersona*",
  "Kind", "Kinship", "Loyal*", "Modesty", "Nag", "Nurtur*", "Pleasant*", "Polite",
  "Quiet*", "Respon*", "Sensitiv*", "Submissive", "Support*", "Sympath*", "Tender*",
  "Together*", "Trust*", "Understand*", "Warm*", "Whin*", "Yield*",
])};
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", ...CORS } }); }
function err(m, s = 500) { return json({ error: m }, s); }
function opts() { return new Response(null, { status: 204, headers: CORS }); }
function tok() { return process.env.BLOB_READ_WRITE_TOKEN; }
function entryIdFromUrl(url) { const p = new URL(url).pathname.split("/").filter(Boolean); const i = p.indexOf("entries"); return i >= 0 && p[i + 1] ? p[i + 1] : ""; }
// Fallback only when the blob genuinely doesn't exist yet; any read failure throws so
// callers never mistake an outage for an empty store and overwrite real data.
async function readJson(p, fb) { const { list } = await import("@vercel/blob"); const { blobs } = await list({ prefix: p, limit: 1, token: tok() }); const m = blobs.find((b) => b.pathname === p); if (!m) return fb; const r = await fetch(m.url + "?v=" + new Date(m.uploadedAt).getTime(), { cache: "no-store" }); if (!r.ok) throw new Error("Failed to read " + p + " (HTTP " + r.status + ")"); return r.json(); }
async function writeJson(p, d) { const { put } = await import("@vercel/blob"); await put(p, JSON.stringify(d), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60, token: tok() }); }
async function getEntries() { return readJson(ENTRIES_BLOB, []); }
async function getEntry(id) { return (await getEntries()).find((e) => e.id === id); }
async function upsertEntry(e) { const all = await getEntries(); if (all.length) await writeJson(ENTRIES_BACKUP_BLOB, all); const i = all.findIndex((x) => x.id === e.id); if (i >= 0) all[i] = e; else all.push(e); await writeJson(ENTRIES_BLOB, all); return e; }
async function deleteEntry(id) { const all = await getEntries(); if (all.length) await writeJson(ENTRIES_BACKUP_BLOB, all); await writeJson(ENTRIES_BLOB, all.filter((e) => e.id !== id)); }
async function getLexicon() { return (await readJson(LEXICON_BLOB, null)) ?? { masculine: [...SEED_MASCULINE], feminine: [...SEED_FEMININE], updatedAt: new Date().toISOString() }; }
async function saveLexicon(l) { const n = { ...l, updatedAt: new Date().toISOString() }; await writeJson(LEXICON_BLOB, n); return n; }
function attachPath(eid, aid, fn) { return \`gender-research/attachments/\${eid}/\${aid}-\${fn.replace(/[^a-zA-Z0-9._-]/g, "_")}\`; }
async function delEntryAttachments(eid) { const { list, del } = await import("@vercel/blob"); const { blobs } = await list({ prefix: \`gender-research/attachments/\${eid}/\`, token: tok() }); await Promise.all(blobs.map((b) => del(b.url, { token: tok() }))); }
function snapshotStamp(d) { const x = d ?? new Date(); return x.toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z"; }
async function readManifest() { return (await readJson(BACKUP_MANIFEST_BLOB, null)) ?? { lastSyncAt: null, entryCount: 0, snapshots: [] }; }
async function deleteBlobPath(pathname) { const { list, del } = await import("@vercel/blob"); const { blobs } = await list({ prefix: pathname, limit: 1, token: tok() }); const m = blobs.find((b) => b.pathname === pathname); if (m?.url) await del(m.url, { token: tok() }); }
function attachmentBackupPath(stamp, eid, aid, fn) {
  return BACKUPS_PREFIX + stamp + "/attachments/" + eid + "/" + aid + "-" + fn.replace(/[^a-zA-Z0-9._-]/g, "_");
}
async function copyBlobFromUrl(sourceUrl, destPathname, contentType) {
  const r = await fetch(sourceUrl, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch blob (HTTP " + r.status + ")");
  const buf = await r.arrayBuffer();
  const { put } = await import("@vercel/blob");
  const blob = await put(destPathname, buf, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: contentType || "application/octet-stream",
    token: tok(),
  });
  return { url: blob.url, pathname: blob.pathname };
}
async function deleteBackupAttachmentTree(stamp) {
  const { list, del } = await import("@vercel/blob");
  const prefix = BACKUPS_PREFIX + stamp + "/attachments/";
  let cursor;
  do {
    const page = await list({ prefix, token: tok(), cursor });
    await Promise.all(page.blobs.map((b) => del(b.url, { token: tok() })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}
async function backupAttachments(stamp, entries) {
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
async function restoreAttachments(stamp, entries) {
  let attachmentCount = 0;
  const restored = [];
  for (const entry of entries) {
    const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
    const nextAttachments = [];
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
async function syncEntriesBackup(trigger) {
  const entries = await getEntries();
  const lexicon = await getLexicon();
  const now = new Date();
  const stamp = snapshotStamp(now);
  const entriesSnapshot = BACKUPS_PREFIX + "entries-" + stamp + ".json";
  const lexiconSnapshot = BACKUPS_PREFIX + "lexicon-" + stamp + ".json";
  if (entries.length) await writeJson(ENTRIES_BACKUP_BLOB, entries);
  if (entries.length) await writeJson(entriesSnapshot, entries);
  await writeJson(lexiconSnapshot, lexicon);
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
  const pruned = snapshots.slice(MAX_SNAPSHOTS);
  for (const s of snapshots.slice(MAX_SNAPSHOTS)) {
    await deleteBlobPath(BACKUPS_PREFIX + "entries-" + s.id + ".json");
    await deleteBlobPath(BACKUPS_PREFIX + "lexicon-" + s.id + ".json");
    await deleteBackupAttachmentTree(s.id);
  }
  const next = {
    lastSyncAt: now.toISOString(),
    entryCount: entries.length,
    attachmentCount,
    rollingEntryCount: entries.length,
    snapshots: pruned,
  };
  await writeJson(BACKUP_MANIFEST_BLOB, next);
  return next;
}
async function restoreEntries(source) {
  let entries = null;
  let stamp = source;
  if (source === "rolling") {
    entries = await readJson(ENTRIES_BACKUP_BLOB, null);
    stamp = "rolling";
  } else {
    const manifest = await readManifest();
    const snap = source === "latest" ? manifest.snapshots?.[0] : (manifest.snapshots || []).find((s) => s.id === source);
    if (!snap) throw new Error("Backup snapshot not found");
    entries = await readJson(BACKUPS_PREFIX + "entries-" + snap.id + ".json", null);
    stamp = snap.id;
  }
  if (!Array.isArray(entries)) throw new Error("Backup is empty or unreadable");
  if (!entries.length) throw new Error("Backup contains no entries");
  const { entries: withAttachments, attachmentCount } = await restoreAttachments(stamp, entries);
  await writeJson(ENTRIES_BLOB, withAttachments);
  return { restored: withAttachments.length, attachments: attachmentCount, source: stamp };
}
function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  return req.headers.get("authorization") === "Bearer " + secret;
}
`;

const header = `export const runtime = "nodejs";\n${STORE}\n`;

mkdirSync(join(root, "api/entries"), { recursive: true });
mkdirSync(join(root, "api/entries/[id]"), { recursive: true });

writeFileSync(
  join(root, "api/lexicon.ts"),
  `${header}
export async function OPTIONS() { return opts(); }
export async function GET() { try { return json(await getLexicon()); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
export async function PUT(req) { try { return json(await saveLexicon(await req.json())); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
`,
);

writeFileSync(
  join(root, "api/entries/index.ts"),
  `${header}
export async function OPTIONS() { return opts(); }
export async function GET() { try { return json(await getEntries()); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
`,
);

writeFileSync(
  join(root, "api/entries/[id].ts"),
  `${header}
export async function OPTIONS() { return opts(); }
export async function GET(req) { try { const id = entryIdFromUrl(req.url); if (!id) return err("Missing id", 400); const e = await getEntry(id); if (!e) return err("Not found", 404); return json(e); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
export async function PUT(req) { try { const id = entryIdFromUrl(req.url); if (!id) return err("Missing id", 400); const b = await req.json(); if (b.id !== id) return err("Mismatch", 400); return json(await upsertEntry(b)); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
export async function DELETE(req) { try { const id = entryIdFromUrl(req.url); if (!id) return err("Missing id", 400); await delEntryAttachments(id); await deleteEntry(id); return json({ ok: true }); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
`,
);

writeFileSync(
  join(root, "api/entries/[id]/attachments.ts"),
  `${header}
export async function OPTIONS() { return opts(); }
export async function POST(req) {
  try {
    const eid = entryIdFromUrl(req.url);
    if (!eid) return err("Missing id", 400);
    const entry = await getEntry(eid);
    if (!entry) return err("Save entry first", 404);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return err("No file", 400);
    const aid = crypto.randomUUID();
    const { put } = await import("@vercel/blob");
    const blob = await put(attachPath(eid, aid, file.name), file, { access: "public", addRandomSuffix: false, contentType: file.type || "application/pdf", token: tok() });
    const meta = { id: aid, fileName: file.name, mimeType: file.type || "application/pdf", uploadedAt: new Date().toISOString(), size: file.size, url: blob.url, pathname: blob.pathname };
    await upsertEntry({ ...entry, attachments: [...entry.attachments, meta], updatedAt: new Date().toISOString() });
    return json(meta);
  } catch (e) { return err(e instanceof Error ? e.message : "Upload failed"); }
}
export async function DELETE(req) {
  try {
    const eid = entryIdFromUrl(req.url);
    if (!eid) return err("Missing id", 400);
    const aid = new URL(req.url).searchParams.get("attachmentId");
    if (!aid) return err("attachmentId required", 400);
    const entry = await getEntry(eid);
    if (!entry) return err("Not found", 404);
    const meta = entry.attachments.find((a) => a.id === aid);
    if (meta?.url) { const { del } = await import("@vercel/blob"); await del(meta.url, { token: tok() }); }
    await upsertEntry({ ...entry, attachments: entry.attachments.filter((a) => a.id !== aid), updatedAt: new Date().toISOString() });
    return json({ ok: true });
  } catch (e) { return err(e instanceof Error ? e.message : "Failed"); }
}
`,
);

mkdirSync(join(root, "api/jobs"), { recursive: true });

writeFileSync(
  join(root, "api/jobs/search.ts"),
  `${header}
const FANTASTIC_BASE = "https://data.fantastic.jobs";
function fantasticKey() { return process.env.FANTASTIC_JOBS_API_KEY?.trim() || ""; }
function pickStr(v) { return typeof v === "string" && v.trim() ? v.trim() : ""; }
function pickIndustry(j) {
  const keys = ["org_linkedin_industry", "linkedin_org_industry", "organization_industry", "org_industry"];
  for (const k of keys) { const s = pickStr(j[k]); if (s) return s; }
  return "";
}
function pickDescription(j) {
  return pickStr(j.description_text) || pickStr(j.description) || pickStr(j.description_html);
}
function pickSourceSite(j) {
  const source = pickStr(j.source);
  if (source) return source;
  const domain = pickStr(j.source_domain);
  if (domain) return domain.replace(/^www\\./i, "");
  const postingUrl = pickStr(j.url);
  if (postingUrl) {
    try { return new URL(postingUrl).hostname.replace(/^www\\./i, ""); } catch {}
  }
  return "";
}
function pickLocation(j) {
  if (Array.isArray(j.locations_derived) && j.locations_derived[0]) {
    const loc = j.locations_derived[0];
    if (typeof loc === "string") return loc;
    if (loc && typeof loc === "object") {
      const parts = [loc.city, loc.admin, loc.country].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
  }
  if (Array.isArray(j.countries_derived) && j.countries_derived[0]) return String(j.countries_derived[0]);
  return "";
}
function annualGbpFromJob(j) {
  const currency = pickStr(j.ai_salary_currency).toUpperCase();
  const unit = pickStr(j.ai_salary_unit_text || j.ai_salary_unittext).toUpperCase();
  if (currency && currency !== "GBP") return null;
  const single = typeof j.ai_salary_value === "number" ? j.ai_salary_value : null;
  const min = typeof j.ai_salary_min_value === "number" ? j.ai_salary_min_value : typeof j.ai_salary_minvalue === "number" ? j.ai_salary_minvalue : null;
  const max = typeof j.ai_salary_max_value === "number" ? j.ai_salary_max_value : typeof j.ai_salary_maxvalue === "number" ? j.ai_salary_maxvalue : null;
  let amount = single;
  if (amount == null && min != null && max != null) amount = Math.round((min + max) / 2);
  else if (amount == null && min != null) amount = min;
  else if (amount == null && max != null) amount = max;
  if (amount == null || amount <= 0) return null;
  if (unit === "YEAR" || unit === "ANNUAL" || unit === "") return Math.round(amount);
  if (unit === "MONTH") return Math.round(amount * 12);
  if (unit === "WEEK") return Math.round(amount * 52);
  if (unit === "DAY") return Math.round(amount * 260);
  if (unit === "HOUR") return Math.round(amount * 40 * 52);
  return null;
}
function mapFantasticJob(j) {
  const externalId = j.id != null ? String(j.id) : "";
  const description = pickDescription(j);
  if (!externalId || !description) return null;
  return {
    externalId,
    title: pickStr(j.title) || "Untitled role",
    company: pickStr(j.organization) || pickStr(j.org_name) || "",
    industry: pickIndustry(j),
    description,
    sourceUrl: pickStr(j.url),
    salaryGbp: annualGbpFromJob(j),
    postedAt: pickStr(j.date_posted) || null,
    location: pickLocation(j),
    sourceSite: pickSourceSite(j),
    importSource: "fantastic-jobs",
  };
}
export async function OPTIONS() { return opts(); }
export async function GET(req) {
  try {
    const key = fantasticKey();
    if (!key) return err("Set FANTASTIC_JOBS_API_KEY in the environment.", 503);
    const url = new URL(req.url);
    const feed = url.searchParams.get("feed") === "jb" ? "v1/active-jb" : "v1/active-ats";
    const limitRaw = Number(url.searchParams.get("limit") || "100");
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100));
    const offsetRaw = Number(url.searchParams.get("offset") || "0");
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);
    const tf = url.searchParams.get("time_frame") || "7d";
    const timeFrame = tf === "1h" || tf === "24h" || tf === "7d" || tf === "6m" ? tf : "7d";
    const cursor = url.searchParams.get("cursor")?.trim() || "";
    const params = new URLSearchParams();
    params.set("time_frame", timeFrame);
    params.set("limit", String(limit));
    if (timeFrame === "6m") params.set("cursor", cursor || "1");
    else params.set("offset", String(offset));
    params.set("description_format", "text");
    params.set("location", url.searchParams.get("location") || "United Kingdom");
    if (feed === "v1/active-ats") params.set("include_basic_organization_details", "true");
    const title = url.searchParams.get("title")?.trim();
    if (title) params.set("title", title);
    const industry = url.searchParams.get("industry")?.trim();
    if (industry) params.set("organization_industry", industry);
    const upstream = await fetch(\`\${FANTASTIC_BASE}/\${feed}?\${params}\`, {
      headers: { Authorization: \`Bearer \${key}\`, Accept: "application/json" },
    });
    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch { return err("Fantastic.jobs returned invalid JSON", upstream.status || 502); }
    if (!upstream.ok) {
      const message = typeof data === "object" && data
        ? String(data.detail || data.message || data.title || raw.slice(0, 200) || "Fantastic.jobs request failed")
        : raw.slice(0, 200) || "Fantastic.jobs request failed";
      return err(message, upstream.status);
    }
    const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    const jobs = rows.map(mapFantasticJob).filter(Boolean);
    const lastRow = rows[rows.length - 1];
    const nextCursor = timeFrame === "6m" && lastRow?.id != null ? String(lastRow.id) : null;
    return json({
      jobs,
      feed,
      count: jobs.length,
      offset,
      limit,
      timeFrame,
      upstreamCount: rows.length,
      skippedWithoutDescription: rows.length - jobs.length,
      hasMore: rows.length >= limit,
      nextCursor,
    });
  } catch (e) { return err(e instanceof Error ? e.message : "Job search failed"); }
}
`,
);

mkdirSync(join(root, "api/entries"), { recursive: true });
mkdirSync(join(root, "api/cron"), { recursive: true });

writeFileSync(
  join(root, "api/entries/backup.ts"),
  `${header}
export async function OPTIONS() { return opts(); }
export async function GET() {
  try {
    const manifest = await readManifest();
    let rollingEntryCount = 0;
    try {
      const rolling = await readJson(ENTRIES_BACKUP_BLOB, []);
      rollingEntryCount = Array.isArray(rolling) ? rolling.length : 0;
    } catch {}
    return json({ ...manifest, rollingEntryCount });
  } catch (e) { return err(e instanceof Error ? e.message : "Failed"); }
}
export async function POST() {
  try { return json(await syncEntriesBackup("manual")); } catch (e) { return err(e instanceof Error ? e.message : "Backup failed"); }
}
`,
);

writeFileSync(
  join(root, "api/entries/restore.ts"),
  `${header}
export async function OPTIONS() { return opts(); }
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const source = typeof body?.source === "string" && body.source.trim() ? body.source.trim() : "latest";
    return json(await restoreEntries(source));
  } catch (e) { return err(e instanceof Error ? e.message : "Restore failed"); }
}
`,
);

writeFileSync(
  join(root, "api/cron/sync-backup.ts"),
  `${header}
export async function GET(req) {
  if (!cronAuthorized(req)) return err("Unauthorized", 401);
  try { return json(await syncEntriesBackup("cron")); } catch (e) { return err(e instanceof Error ? e.message : "Backup failed"); }
}
`,
);

console.log("Generated API routes");
