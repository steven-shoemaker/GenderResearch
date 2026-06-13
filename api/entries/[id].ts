export const runtime = "nodejs";
import { opts, json, err, entryIdFromUrl, getEntry, upsertEntry, delEntryAttachments, deleteEntry } from "../_lib/store.js";

export async function OPTIONS() { return opts(); }
export async function GET(req: Request) { try { const id = entryIdFromUrl(req.url); if (!id) return err("Missing id", 400); const e = await getEntry(id); if (!e) return err("Not found", 404); return json(e); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
export async function PUT(req: Request) { try { const id = entryIdFromUrl(req.url); if (!id) return err("Missing id", 400); const b = await req.json(); if (b.id !== id) return err("Mismatch", 400); return json(await upsertEntry(b)); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
export async function DELETE(req: Request) { try { const id = entryIdFromUrl(req.url); if (!id) return err("Missing id", 400); await delEntryAttachments(id); await deleteEntry(id); return json({ ok: true }); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
