export const runtime = "nodejs";
import {
  opts,
  json,
  err,
  categoryIdFromUrl,
  renameCategory,
  deleteCategory,
} from "../_lib/store.js";

export async function OPTIONS() {
  return opts();
}

export async function PATCH(req: Request) {
  try {
    const id = categoryIdFromUrl(req.url);
    if (!id) return err("Missing id", 400);
    const body = await req.json();
    if (typeof body?.name !== "string") return err("Name is required", 400);
    return json(await renameCategory(id, body.name));
  } catch (e) {
    return err(e instanceof Error ? e.message : "Rename failed", 400);
  }
}

export async function DELETE(req: Request) {
  try {
    const id = categoryIdFromUrl(req.url);
    if (!id) return err("Missing id", 400);
    const raw = new URL(req.url).searchParams.get("reassignTo");
    const reassignTo = raw && raw.trim() ? raw.trim() : null;
    const result = await deleteCategory(id, reassignTo);
    return json({ deleted: true, ...result });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Delete failed", 400);
  }
}
