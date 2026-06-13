export const runtime = "nodejs";
import { opts, json, err, readManifest, readJson, ENTRIES_BACKUP_BLOB, syncEntriesBackup, type Entry } from "../_lib/store.js";

export async function OPTIONS() { return opts(); }
export async function GET() {
  try {
    const manifest = await readManifest();
    let rollingEntryCount = 0;
    try {
      const rolling = await readJson<Entry[]>(ENTRIES_BACKUP_BLOB, []);
      rollingEntryCount = Array.isArray(rolling) ? rolling.length : 0;
    } catch {}
    return json({ ...manifest, rollingEntryCount });
  } catch (e) { return err(e instanceof Error ? e.message : "Failed"); }
}
export async function POST() {
  try { return json(await syncEntriesBackup("manual")); } catch (e) { return err(e instanceof Error ? e.message : "Backup failed"); }
}
