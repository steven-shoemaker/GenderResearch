export const runtime = "nodejs";
import { opts, json, err, getEntries } from "../_lib/store.js";

export async function OPTIONS() { return opts(); }
export async function GET() { try { return json(await getEntries()); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
