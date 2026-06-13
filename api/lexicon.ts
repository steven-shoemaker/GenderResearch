export const runtime = "nodejs";
import { opts, json, err, getLexicon, saveLexicon } from "./_lib/store";

export async function OPTIONS() { return opts(); }
export async function GET() { try { return json(await getLexicon()); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
export async function PUT(req: Request) { try { return json(await saveLexicon(await req.json())); } catch (e) { return err(e instanceof Error ? e.message : "Failed"); } }
