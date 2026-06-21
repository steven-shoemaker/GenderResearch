export const runtime = "nodejs";
import { opts, json, err, upsertEntries, type Entry } from "../_lib/store.js";

export async function OPTIONS() {
  return opts();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) return err("Expected a JSON array of entries.", 400);
    const entries = body as Entry[];
    for (const e of entries) {
      if (!e || typeof e !== "object" || typeof e.id !== "string" || !e.id.trim()) {
        return err("Each entry must have an id.", 400);
      }
    }
    const result = await upsertEntries(entries);
    return json(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Import failed");
  }
}
