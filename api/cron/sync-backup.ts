export const runtime = "nodejs";
import { json, err, cronAuthorized, syncEntriesBackup } from "../_lib/store.js";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return err("Unauthorized", 401);
  try { return json(await syncEntriesBackup("cron")); } catch (e) { return err(e instanceof Error ? e.message : "Backup failed"); }
}
