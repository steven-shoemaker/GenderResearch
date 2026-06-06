import { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CorpusSummary } from "../components/CorpusSummary";
import { EntriesTable } from "../components/EntriesTable";
import { Toast } from "../components/ui/Toast";
import { fetchEntries, fetchLexicon } from "../lib/api-client";
import { computeCorpusStats } from "../lib/corpus-stats";
import { exportEntriesCsv } from "../lib/export-csv";
import { recomputeStaleEntries } from "../lib/recompute-entries";
import { entryTitle } from "../lib/entries";
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
        (e.industry ?? "").toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q) ||
        e.bodyText.toLowerCase().includes(q),
    );
  }
  return list.sort(
    (a, b) =>
      new Date(b.capturedDate).getTime() - new Date(a.capturedDate).getTime(),
  );
}

export function CorpusPage() {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recomputingAll, setRecomputingAll] = useState(false);
  const [recomputeProgress, setRecomputeProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [recomputeMessage, setRecomputeMessage] = useState<{
    tone: "success" | "warn";
    text: string;
  } | null>(null);

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

  const handleRecomputeAll = async () => {
    if (!lexicon || corpusStats.staleCount === 0) return;
    setRecomputingAll(true);
    setRecomputeMessage(null);
    setError(null);
    try {
      const { succeeded, failed } = await recomputeStaleEntries(
        entries,
        lexicon,
        showArchived,
        (done, total) => setRecomputeProgress({ done, total }),
      );

      if (succeeded.length > 0) {
        const byId = new Map(succeeded.map((e) => [e.id, e]));
        setEntries((prev) => prev.map((e) => byId.get(e.id) ?? e));
      }

      if (failed > 0 && succeeded.length > 0) {
        setRecomputeMessage({
          tone: "warn",
          text: `Updated ${succeeded.length} entries. ${failed} could not be saved.`,
        });
      } else if (failed > 0) {
        setRecomputeMessage({
          tone: "warn",
          text: "Could not recompute entries. Try again.",
        });
      } else if (succeeded.length > 0) {
        setRecomputeMessage({
          tone: "success",
          text:
            succeeded.length === 1
              ? "1 entry recomputed."
              : `${succeeded.length} entries recomputed.`,
        });
      }
    } catch {
      setRecomputeMessage({
        tone: "warn",
        text: "Recompute all failed. Try again.",
      });
    } finally {
      setRecomputingAll(false);
      setRecomputeProgress(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Entries"
        description="Paste job descriptions, analyze gendered language, and save your research."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || exportableCount === 0 || recomputingAll}
              className="btn btn-secondary"
              title={
                exportableCount === 0
                  ? "No entries to export"
                  : "Download collection as CSV"
              }
            >
              Export CSV
            </button>
            <Link to="/import" className="btn btn-secondary">
              Import jobs
            </Link>
            <Link to="/entry/new" className="btn btn-primary">
              New entry
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
            className="field-input min-h-10 py-2"
            disabled={recomputingAll}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer min-h-10 shrink-0 px-1">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            disabled={recomputingAll}
            className="size-4 rounded border-line text-accent focus:ring-accent/30"
          />
          Show archived
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/25 bg-danger-soft text-danger text-sm px-3 py-2">
          {error}
        </p>
      )}

      {recomputeMessage && (
        <Toast tone={recomputeMessage.tone === "success" ? "success" : "warn"}>
          {recomputeMessage.text}
        </Toast>
      )}

      {!loading && (
        <CorpusSummary
          stats={corpusStats}
          showArchived={showArchived}
          onRecomputeAll={
            lexicon && corpusStats.staleCount > 0 ? () => void handleRecomputeAll() : undefined
          }
          recomputingAll={recomputingAll}
          recomputeProgress={recomputeProgress}
        />
      )}

      {loading ? (
        <p className="text-muted text-sm py-6">Loading entries…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
          <p className="font-medium text-ink">
            {showArchived ? "No archived entries" : "Your research log is empty"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {showArchived
              ? "Archived entries will appear here."
              : "Start with a pasted job description."}
          </p>
          {!showArchived && (
            <Link to="/entry/new" className="btn btn-primary mt-4">
              New entry
            </Link>
          )}
        </div>
      ) : (
        <EntriesTable entries={visible} lexicon={lexicon} />
      )}
    </div>
  );
}
