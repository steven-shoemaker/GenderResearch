export const runtime = "nodejs";
import { opts, json, err, restoreEntries } from "../_lib/store";

export async function OPTIONS() { return opts(); }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const source = typeof body?.source === "string" && body.source.trim() ? body.source.trim() : "latest";
    return json(await restoreEntries(source));
  } catch (e) { return err(e instanceof Error ? e.message : "Restore failed"); }
}
