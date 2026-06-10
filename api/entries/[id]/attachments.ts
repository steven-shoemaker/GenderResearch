export const runtime = "nodejs";

const ENTRIES_BLOB = "gender-research/entries.json";
const ENTRIES_BACKUP_BLOB = "gender-research/entries.backup.json";
const LEXICON_BLOB = "gender-research/lexicon.json";
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
