import { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CorpusSummary } from "../components/CorpusSummary";
import { EntryScoreGlance } from "../components/EntryScoreGlance";
import { fetchEntries, fetchLexicon } from "../lib/api-client";
import { computeCorpusStats } from "../lib/corpus-stats";
import { exportEntriesCsv } from "../lib/export-csv";
import { entryTitle } from "../lib/entries";
import { entryIsStale } from "../lib/utils";
import { PageHeader } from "../components/ui/PageHeader";
import type { Entry, Lexicon } from "../types";

function filterEntries(
  entries: Entry[],
  query: string,
  showArchived: boolean,
): Entry[] {
  let list = entries.filter((e) => e.saved && e.archived === showArchived);
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (e) =>
        entryTitle(e).toLowerCase().includes(q) ||
        e.company.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q) ||
        e.bodyText.toLowerCase().includes(q),
    );
  }
  return list.sort(
    (a, b) =>
      new Date(b.capturedDate).getTime() - new Date(a.capturedDate).getTime(),
  );
}

function formatCapturedDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function CorpusPage() {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [e, l] = await Promise.all([fetchEntries(), fetchLexicon()]);
        if (!cancelled) {
          setEntries(e);
          setLexicon(l);
        }
      } catch {
        if (!cancelled)
          setError("Could not load entries. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = filterEntries(entries, search, showArchived);
  const corpusStats = useMemo(
    () => computeCorpusStats(entries, showArchived, lexicon),
    [entries, showArchived, lexicon],
  );

  const exportableCount = entries.filter(
    (e) => e.saved && e.archived === showArchived,
  ).length;

  const handleExportCsv = () => {
    exportEntriesCsv(entries, lexicon, { archivedOnly: showArchived });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Entries"
        description="Paste job descriptions, analyze gendered language, and save your research."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || exportableCount === 0}
              className="btn btn-secondary"
              title={
                exportableCount === 0
                  ? "No entries to export"
                  : "Download collection as CSV"
              }
            >
              Export CSV
            </button>
            <Link to="/entry/new" className="btn btn-primary">
              New entry
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1" role="search">
          <label htmlFor="search-entries" className="sr-only">
            Search entries
          </label>
          <input
            id="search-entries"
            type="search"
            placeholder="Search title, company, notes, or text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-input min-h-11"
          />
        </div>
        <label className="inline-flex items-center gap-2.5 text-sm text-muted cursor-pointer min-h-11 shrink-0 px-1">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="size-4 rounded border-line text-accent focus:ring-accent/30"
          />
          Show archived
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/25 bg-danger-soft text-danger text-sm px-4 py-2.5">
          {error}
        </p>
      )}

      {!loading && <CorpusSummary stats={corpusStats} showArchived={showArchived} />}

      {loading ? (
        <p className="text-muted text-sm py-8">Loading entries…</p>
      ) : visible.length === 0 ? (
        <div className="panel px-8 py-14 text-center">
          <p className="font-serif text-lg text-ink">
            {showArchived ? "No archived entries" : "Your research log is empty"}
          </p>
          <p className="mt-2 text-sm text-muted max-w-sm mx-auto leading-relaxed">
            {showArchived
              ? "Archived entries will appear here."
              : "Start with a pasted job description. Analysis uses your word list."}
          </p>
          {!showArchived && (
            <Link to="/entry/new" className="btn btn-primary mt-6">
              New entry
            </Link>
          )}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="hidden sm:flex items-center justify-end gap-6 px-6 py-2 border-b border-line text-[0.625rem] font-medium uppercase tracking-wide text-muted">
            <span className="w-36 text-center">Language comparison</span>
          </div>
          <ul className="divide-y divide-line">
            {visible.map((entry) => {
              const stale = lexicon ? entryIsStale(entry, lexicon) : false;
              const a = entry.analysis;
              return (
                <li key={entry.id}>
                  <Link
                    to={`/entry/${entry.id}`}
                    className="group flex items-start justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 hover:bg-surface-hover transition-colors duration-200"
                    style={{ transitionTimingFunction: "var(--ease-out)" }}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2.5">
                        <h2 className="font-medium text-ink truncate group-hover:text-accent transition-colors duration-200">
                          {entryTitle(entry)}
                        </h2>
                        {stale && (
                          <span
                            className="shrink-0 size-2 rounded-full bg-warn-text/80"
                            title="Scores outdated"
                            aria-label="Scores outdated"
                          />
                        )}
                      </div>
                      {entry.company && (
                        <p className="text-sm text-muted truncate">{entry.company}</p>
                      )}
                      <p className="text-xs text-muted tabular-nums">
                        {formatCapturedDate(entry.capturedDate)}
                      </p>
                    </div>
                    {a ? (
                      <EntryScoreGlance
                        masculinePercent={a.masculinePercent}
                        femininePercent={a.femininePercent}
                      />
                    ) : (
                      <span className="text-xs text-muted shrink-0 w-24 text-right">
                        No scores
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
