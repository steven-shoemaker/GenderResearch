export const runtime = "nodejs";
import { opts, json, err, entryIdFromUrl, getEntry, attachPath, upsertEntry, tok } from "../../_lib/store";

export async function OPTIONS() { return opts(); }
export async function POST(req: Request) {
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
export async function DELETE(req: Request) {
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
