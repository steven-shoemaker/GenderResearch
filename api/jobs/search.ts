export const runtime = "nodejs";
import { opts, json, err } from "../_lib/store.js";

const FANTASTIC_BASE = "https://data.fantastic.jobs";
function fantasticKey() { return process.env.FANTASTIC_JOBS_API_KEY?.trim() || ""; }
function pickStr(v: unknown) { return typeof v === "string" && v.trim() ? v.trim() : ""; }
function pickIndustry(j: any) {
  const keys = ["org_linkedin_industry", "linkedin_org_industry", "organization_industry", "org_industry"];
  for (const k of keys) { const s = pickStr(j[k]); if (s) return s; }
  return "";
}
function pickDescription(j: any) {
  return pickStr(j.description_text) || pickStr(j.description) || pickStr(j.description_html);
}
function pickSourceSite(j: any) {
  const source = pickStr(j.source);
  if (source) return source;
  const domain = pickStr(j.source_domain);
  if (domain) return domain.replace(/^www\./i, "");
  const postingUrl = pickStr(j.url);
  if (postingUrl) {
    try { return new URL(postingUrl).hostname.replace(/^www\./i, ""); } catch {}
  }
  return "";
}
function pickLocation(j: any) {
  if (Array.isArray(j.locations_derived) && j.locations_derived[0]) {
    const loc = j.locations_derived[0];
    if (typeof loc === "string") return loc;
    if (loc && typeof loc === "object") {
      const parts = [loc.city, loc.admin, loc.country].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
  }
  if (Array.isArray(j.countries_derived) && j.countries_derived[0]) return String(j.countries_derived[0]);
  return "";
}
function annualGbpFromJob(j: any) {
  const currency = pickStr(j.ai_salary_currency).toUpperCase();
  const unit = pickStr(j.ai_salary_unit_text || j.ai_salary_unittext).toUpperCase();
  if (currency && currency !== "GBP") return null;
  const single = typeof j.ai_salary_value === "number" ? j.ai_salary_value : null;
  const min = typeof j.ai_salary_min_value === "number" ? j.ai_salary_min_value : typeof j.ai_salary_minvalue === "number" ? j.ai_salary_minvalue : null;
  const max = typeof j.ai_salary_max_value === "number" ? j.ai_salary_max_value : typeof j.ai_salary_maxvalue === "number" ? j.ai_salary_maxvalue : null;
  let amount = single;
  if (amount == null && min != null && max != null) amount = Math.round((min + max) / 2);
  else if (amount == null && min != null) amount = min;
  else if (amount == null && max != null) amount = max;
  if (amount == null || amount <= 0) return null;
  if (unit === "YEAR" || unit === "ANNUAL" || unit === "") return Math.round(amount);
  if (unit === "MONTH") return Math.round(amount * 12);
  if (unit === "WEEK") return Math.round(amount * 52);
  if (unit === "DAY") return Math.round(amount * 260);
  if (unit === "HOUR") return Math.round(amount * 40 * 52);
  return null;
}
function mapFantasticJob(j: any) {
  const externalId = j.id != null ? String(j.id) : "";
  const description = pickDescription(j);
  if (!externalId || !description) return null;
  return {
    externalId,
    title: pickStr(j.title) || "Untitled role",
    company: pickStr(j.organization) || pickStr(j.org_name) || "",
    industry: pickIndustry(j),
    description,
    sourceUrl: pickStr(j.url),
    salaryGbp: annualGbpFromJob(j),
    postedAt: pickStr(j.date_posted) || null,
    location: pickLocation(j),
    sourceSite: pickSourceSite(j),
    importSource: "fantastic-jobs",
  };
}
export async function OPTIONS() { return opts(); }
export async function GET(req: Request) {
  try {
    const key = fantasticKey();
    if (!key) return err("Set FANTASTIC_JOBS_API_KEY in the environment.", 503);
    const url = new URL(req.url);
    const feed = url.searchParams.get("feed") === "jb" ? "v1/active-jb" : "v1/active-ats";
    const limitRaw = Number(url.searchParams.get("limit") || "100");
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100));
    const offsetRaw = Number(url.searchParams.get("offset") || "0");
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);
    const tf = url.searchParams.get("time_frame") || "7d";
    const timeFrame = tf === "1h" || tf === "24h" || tf === "7d" || tf === "6m" ? tf : "7d";
    const cursor = url.searchParams.get("cursor")?.trim() || "";
    const params = new URLSearchParams();
    params.set("time_frame", timeFrame);
    params.set("limit", String(limit));
    if (timeFrame === "6m") params.set("cursor", cursor || "1");
    else params.set("offset", String(offset));
    params.set("description_format", "text");
    params.set("location", url.searchParams.get("location") || "United Kingdom");
    if (feed === "v1/active-ats") params.set("include_basic_organization_details", "true");
    const title = url.searchParams.get("title")?.trim();
    if (title) params.set("title", title);
    const industry = url.searchParams.get("industry")?.trim();
    if (industry) params.set("organization_industry", industry);
    const upstream = await fetch(`${FANTASTIC_BASE}/${feed}?${params}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch { return err("Fantastic.jobs returned invalid JSON", upstream.status || 502); }
    if (!upstream.ok) {
      const message = typeof data === "object" && data
        ? String(data.detail || data.message || data.title || raw.slice(0, 200) || "Fantastic.jobs request failed")
        : raw.slice(0, 200) || "Fantastic.jobs request failed";
      return err(message, upstream.status);
    }
    const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    const jobs = rows.map(mapFantasticJob).filter(Boolean);
    const lastRow = rows[rows.length - 1];
    const nextCursor = timeFrame === "6m" && lastRow?.id != null ? String(lastRow.id) : null;
    return json({
      jobs,
      feed,
      count: jobs.length,
      offset,
      limit,
      timeFrame,
      upstreamCount: rows.length,
      skippedWithoutDescription: rows.length - jobs.length,
      hasMore: rows.length >= limit,
      nextCursor,
    });
  } catch (e) { return err(e instanceof Error ? e.message : "Job search failed"); }
}
