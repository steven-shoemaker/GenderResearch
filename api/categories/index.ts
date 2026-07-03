export const runtime = "nodejs";
import { opts, json, err, getCategories, saveCategories } from "../_lib/store.js";

export async function OPTIONS() {
  return opts();
}

export async function GET() {
  try {
    return json(await getCategories());
  } catch (e) {
    return err(e instanceof Error ? e.message : "Failed");
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) return err("Expected array", 400);
    for (const c of body) {
      if (!c || typeof c.id !== "string" || typeof c.name !== "string") {
        return err("Each category needs id and name", 400);
      }
      if (!c.name.trim()) return err("Category name cannot be empty", 400);
    }
    const ids = body.map((c: { id: string }) => c.id);
    if (new Set(ids).size !== ids.length) return err("Duplicate category ids", 400);
    return json(await saveCategories(body));
  } catch (e) {
    return err(e instanceof Error ? e.message : "Failed");
  }
}
