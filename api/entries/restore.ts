export const runtime = "nodejs";

const ENTRIES_BLOB = "gender-research/entries.json";
const ENTRIES_BACKUP_BLOB = "gender-research/entries.backup.json";
const LEXICON_BLOB = "gender-research/lexicon.json";
const BACKUPS_PREFIX = "gender-research/backups/";
const BACKUP_MANIFEST_BLOB = "gender-research/backups/manifest.json";
const MAX_SNAPSHOTS = 60;
const SEED_MASCULINE = ["Active","Adventurous","Aggress*","Ambitio*","Analy*","Assert*","Athlet*","Autonom*","Boast*","Challeng*","Compet*","Confident","Courag*","Decide","Decisive","Decision*","Determin*","Dominant","Domina*","Force*","Greedy","Headstrong","Hierarch*","Hostil*","Implusive","Independen*","Individual*","Intellect*","Lead*","Logic","Masculine","Objective","Opinion","Outspoken","Persist","Principle*","Reckless","Stubborn","Superior","Self-confiden*","Self-sufficien*","Self-relian*"];
const SEED_FEMININE = ["Affectionate","Child*","Cheer*","Commit*","Communal","Compassion*","Connect*","Considerate","Cooperat*","Depend*","Emotiona*","Empath*","Feminine","Flatterable","Gentle","Honest","Interpersonal","Interdependen*","Interpersona*","Kind","Kinship","Loyal*","Modesty","Nag","Nurtur*","Pleasant*","Polite","Quiet*","Respon*","Sensitiv*","Submissive","Support*","Sympath*","Tender*","Together*","Trust*","Understand*","Warm*","Whin*","Yield*"];
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
function attachPath(eid, aid, fn) { return `gender-research/attachments/${eid}/${aid}-${fn.replace(/[^a-zA-Z0-9._-]/g, "_")}`; }
async function delEntryAttachments(eid) { const { list, del } = await import("@vercel/blob"); const { blobs } = await list({ prefix: `gender-research/attachments/${eid}/`, token: tok() }); await Promise.all(blobs.map((b) => del(b.url, { token: tok() }))); }
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


export async function OPTIONS() { return opts(); }
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const source = typeof body?.source === "string" && body.source.trim() ? body.source.trim() : "latest";
    return json(await restoreEntries(source));
  } catch (e) { return err(e instanceof Error ? e.message : "Restore failed"); }
}
