import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchEntries, fetchLexicon } from "../lib/api-client";
import { formatPercent } from "../lib/analyze";
import { entryTitle } from "../lib/entries";
import { entryIsStale } from "../lib/utils";
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
        if (!cancelled) setError("Could not load entries. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = filterEntries(entries, search, showArchived);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Entries</h1>
          <p className="mt-1 text-muted text-sm">
            Paste job descriptions, analyze gendered language, and save your research.
          </p>
        </div>
        <Link
          to="/entry/new"
          className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-900 transition-colors min-h-11"
        >
          New entry
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
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
            className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 min-h-11"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer min-h-11 px-2">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-stone-300"
          />
          Show archived
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading entries…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <p className="text-muted">
            {showArchived
              ? "No archived entries."
              : "Paste a job description to analyze gendered language."}
          </p>
          {!showArchived && (
            <Link
              to="/entry/new"
              className="mt-4 inline-block text-sm font-semibold text-accent hover:underline"
            >
              New entry
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((entry) => {
            const stale = lexicon ? entryIsStale(entry, lexicon) : false;
            const a = entry.analysis;
            return (
              <li key={entry.id}>
                <Link
                  to={`/entry/${entry.id}`}
                  className="block rounded-xl border border-stone-200 bg-white p-4 hover:border-accent/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-medium text-ink truncate">
                          {entryTitle(entry)}
                        </h2>
                        {stale && (
                          <span
                            className="shrink-0 w-2 h-2 rounded-full bg-amber-500"
                            title="Scores outdated"
                            aria-label="Scores outdated"
                          />
                        )}
                      </div>
                      {entry.company && (
                        <p className="text-sm text-muted truncate">{entry.company}</p>
                      )}
                      <p className="text-xs text-muted mt-1">{entry.capturedDate}</p>
                    </div>
                    {a && (
                      <div className="text-right text-sm tabular-nums shrink-0">
                        <p className="text-masc-text font-medium">
                          {formatPercent(a.masculinePercent)}% M
                        </p>
                        <p className="text-fem-text font-medium">
                          {formatPercent(a.femininePercent)}% F
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
