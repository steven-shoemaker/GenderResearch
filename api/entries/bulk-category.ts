export const runtime = "nodejs";
import { opts, json, err, bulkSetEntryCategory } from "../_lib/store.js";

export async function OPTIONS() {
  return opts();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawIds = Array.isArray(body?.entryIds) ? body.entryIds : null;
    const ids = rawIds?.filter(
      (id: unknown): id is string => typeof id === "string" && id.trim().length > 0,
    );
    if (!ids || ids.length === 0) {
      return err("Expected a non-empty entryIds array.", 400);
    }
    const categoryId =
      typeof body?.categoryId === "string" && body.categoryId.trim() ? body.categoryId.trim() : null;
    const result = await bulkSetEntryCategory(ids, categoryId);
    return json(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Bulk category update failed");
  }
}
