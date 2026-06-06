import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchEntries,
  fetchLexicon,
  saveEntry,
  searchImportJobs,
} from "../lib/api-client";
import { analyzeText } from "../lib/analyze";
import { entryImportKey, importJobKey, listingToEntry } from "../lib/import-jobs";
import { ImportJobDrawer } from "../components/ImportJobDrawer";
import { Field, TextInput } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import { Toast } from "../components/ui/Toast";
import type { ImportJobListing, Lexicon } from "../types";

const IMPORT_PAGE_SIZE = 100;

function mergeJobResults(
  prev: ImportJobListing[],
  incoming: ImportJobListing[],
): ImportJobListing[] {
  const ids = new Set(prev.map((j) => j.externalId));
  return [...prev, ...incoming.filter((j) => !ids.has(j.externalId))];
}

function formatSalary(gbp: number | null): string {
  if (gbp == null) return "—";
  return `£${gbp.toLocaleString("en-GB")}`;
}

export function ImportPage() {
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("United Kingdom");
  const [feed, setFeed] = useState<"ats" | "jb">("ats");
  const [jobs, setJobs] = useState<ImportJobListing[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());
  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<ImportJobListing | null>(null);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skippedLastPage, setSkippedLastPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [entries, lex] = await Promise.all([fetchEntries(), fetchLexicon()]);
        if (cancelled) return;
        const keys = new Set<string>();
        for (const e of entries) {
          const key = entryImportKey(e);
          if (key) keys.add(key);
        }
        setImportedKeys(keys);
        setLexicon(lex);
      } catch {
        if (!cancelled) setError("Could not load entries or word list.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const jobKey = useCallback(
    (job: ImportJobListing) => importJobKey(job.importSource, job.externalId),
    [],
  );

  const selectableJobs = useMemo(
    () => jobs.filter((j) => !importedKeys.has(jobKey(j))),
    [jobs, importedKeys, jobKey],
  );

  const searchParams = useMemo(
    () => ({
      title: title.trim() || undefined,
      industry: industry.trim() || undefined,
      location: location.trim() || "United Kingdom",
      limit: IMPORT_PAGE_SIZE,
      feed,
      timeFrame: "7d" as const,
    }),
    [title, industry, location, feed],
  );

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    setToast(null);
    setSelected(new Set());
    setNextOffset(0);
    setHasMore(false);
    setSkippedLastPage(0);
    try {
      const res = await searchImportJobs({ ...searchParams, offset: 0 });
      setJobs(res.jobs);
      setNextOffset(res.offset + res.upstreamCount);
      setHasMore(res.hasMore);
      setSkippedLastPage(res.skippedWithoutDescription);
      setPreviewJob(null);
      if (res.jobs.length === 0) {
        setToast("No jobs matched. Try broader keywords or a different feed.");
      }
    } catch (e) {
      setJobs([]);
      setError(e instanceof Error ? e.message : "Job search failed.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await searchImportJobs({ ...searchParams, offset: nextOffset });
      setJobs((prev) => mergeJobResults(prev, res.jobs));
      setNextOffset((prev) => prev + res.upstreamCount);
      setHasMore(res.hasMore);
      setSkippedLastPage(res.skippedWithoutDescription);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more jobs.");
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === selectableJobs.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectableJobs.map((j) => j.externalId)));
  };

  const importSelected = async () => {
    if (!lexicon || selected.size === 0) return;
    const toImport = jobs.filter((j) => selected.has(j.externalId));
    setImporting(true);
    setError(null);
    setImportProgress({ done: 0, total: toImport.length });
    let succeeded = 0;
    const newKeys = new Set(importedKeys);

    for (let i = 0; i < toImport.length; i++) {
      const listing = toImport[i]!;
      try {
        const analysis = analyzeText(listing.description, lexicon);
        const entry = listingToEntry(listing, analysis);
        await saveEntry(entry);
        newKeys.add(jobKey(listing));
        succeeded++;
      } catch {
        setError(`Import stopped after ${succeeded} of ${toImport.length}. Try again.`);
        break;
      }
      setImportProgress({ done: i + 1, total: toImport.length });
    }

    setImportedKeys(newKeys);
    setSelected(new Set());
    setImporting(false);
    setImportProgress(null);
    if (succeeded > 0) {
      setToast(
        succeeded === 1
          ? "Imported 1 entry. Open it from Entries."
          : `Imported ${succeeded} entries. View them on Entries.`,
      );
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Import jobs"
        description="Search Fantastic.jobs, select postings, and add them to your corpus with analysis and industry metadata."
        back={
          <Link to="/" className="text-link text-sm min-h-11 inline-flex items-center">
            ← Entries
          </Link>
        }
      />

      {toast && <Toast tone="success">{toast}</Toast>}

      {error && (
        <p className="rounded-lg border border-danger/25 bg-danger-soft text-danger text-sm px-4 py-2.5">
          {error}
        </p>
      )}

      <section className="panel p-5 space-y-5">
        <h2 className="text-base font-semibold text-ink">Search</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Keywords" htmlFor="import-title" hint="Job title search, e.g. nurse or product manager">
            <TextInput
              id="import-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field
            label="Industry"
            htmlFor="import-industry"
            hint="LinkedIn industry name — exact match, case-sensitive (e.g. Financial Services)"
          >
            <TextInput
              id="import-industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field label="Location" htmlFor="import-location">
            <TextInput
              id="import-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </Field>
          <Field label="Source feed" htmlFor="import-feed">
            <select
              id="import-feed"
              value={feed}
              onChange={(e) => setFeed(e.target.value as "ats" | "jb")}
              className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink min-h-11 focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="ats">Career sites (ATS)</option>
              <option value="jb">Job boards (LinkedIn, etc.)</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={loading || importing}
            className="btn btn-primary"
          >
            {loading ? "Searching…" : "Search jobs"}
          </button>
        </div>
        <p className="text-xs text-muted">
          Fetches up to {IMPORT_PAGE_SIZE} jobs per request from the last 7 days (one API credit per job
          returned). Use Load more for additional pages. Click a row to preview the full description.
        </p>
      </section>

      {jobs.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">
                Results <span className="text-muted font-normal">({jobs.length})</span>
              </h2>
              {skippedLastPage > 0 && (
                <p className="text-xs text-muted mt-0.5">
                  {skippedLastPage} listing{skippedLastPage === 1 ? "" : "s"} on the last page had no
                  description and were skipped.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAll}
                disabled={importing || selectableJobs.length === 0}
                className="btn btn-ghost text-sm"
              >
                {selected.size === selectableJobs.length && selectableJobs.length > 0
                  ? "Clear selection"
                  : "Select all new"}
              </button>
              <button
                type="button"
                onClick={() => void importSelected()}
                disabled={importing || selected.size === 0 || !lexicon}
                className="btn btn-secondary"
              >
                {importing
                  ? importProgress
                    ? `Importing ${importProgress.done}/${importProgress.total}…`
                    : "Importing…"
                  : `Import selected (${selected.size})`}
              </button>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="overflow-auto max-h-[min(32rem,65vh)]">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-surface shadow-[0_1px_0_var(--color-line)]">
                  <tr className="text-left text-xs font-medium text-muted">
                    <th scope="col" className="py-2.5 pl-4 pr-2 w-10">
                      <span className="sr-only">Select</span>
                    </th>
                    <th scope="col" className="py-2.5 px-2">
                      Title
                    </th>
                    <th scope="col" className="py-2.5 px-2 hidden sm:table-cell">
                      Company
                    </th>
                    <th scope="col" className="py-2.5 px-2 hidden lg:table-cell">
                      Industry
                    </th>
                    <th scope="col" className="py-2.5 px-2">
                      Source
                    </th>
                    <th scope="col" className="py-2.5 px-2 whitespace-nowrap">
                      Salary
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const imported = importedKeys.has(jobKey(job));
                    const checked = selected.has(job.externalId);
                    const isPreview = previewJob?.externalId === job.externalId;
                    return (
                      <tr
                        key={job.externalId}
                        onClick={() => setPreviewJob(job)}
                        className={`border-t border-line cursor-pointer ${
                          imported ? "opacity-50" : "hover:bg-surface-hover"
                        } ${isPreview ? "bg-surface-hover" : ""}`}
                      >
                        <td className="py-2.5 pl-4 pr-2 align-top" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={imported || importing}
                            onChange={() => toggleOne(job.externalId)}
                            aria-label={`Select ${job.title}`}
                            className="size-4 rounded border-line text-accent focus:ring-accent/30"
                          />
                        </td>
                        <td className="py-2.5 px-2 align-top">
                          <div className="font-medium text-ink">{job.title}</div>
                          {job.location && (
                            <div className="text-xs text-muted mt-0.5">{job.location}</div>
                          )}
                          {imported && (
                            <div className="text-xs text-muted mt-0.5">Already imported</div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 align-top hidden sm:table-cell text-muted">
                          {job.company || "—"}
                        </td>
                        <td className="py-2.5 px-2 align-top hidden lg:table-cell text-muted">
                          {job.industry || "—"}
                        </td>
                        <td className="py-2.5 px-2 align-top text-muted max-w-[10rem] sm:max-w-[12rem]">
                          <span className="block truncate" title={job.sourceSite || undefined}>
                            {job.sourceSite || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 align-top tabular-nums text-muted whitespace-nowrap">
                          {formatSalary(job.salaryGbp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {hasMore && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore || importing}
                className="btn btn-secondary"
              >
                {loadingMore ? "Loading…" : `Load more (next ${IMPORT_PAGE_SIZE})`}
              </button>
            </div>
          )}
        </section>
      )}

      <ImportJobDrawer
        job={previewJob}
        imported={previewJob ? importedKeys.has(jobKey(previewJob)) : false}
        selected={previewJob ? selected.has(previewJob.externalId) : false}
        importing={importing}
        onClose={() => setPreviewJob(null)}
        onToggleSelect={() => {
          if (previewJob) toggleOne(previewJob.externalId);
        }}
      />
    </div>
  );
}
