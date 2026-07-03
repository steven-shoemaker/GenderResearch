import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCategories, fetchEntries, fetchLexicon } from "../lib/api-client";
import { sortCategories } from "../lib/categories";
import {
  CATEGORY_SORT_OPTIONS,
  computeCategoryAnalytics,
  sortCategoryAnalytics,
  type CategorySortKey,
} from "../lib/category-analytics";
import { computeCorpusStats } from "../lib/corpus-stats";
import { CorpusSummary } from "../components/CorpusSummary";
import { GenderComparisonBar } from "../components/GenderComparisonBar";
import { PageHeader } from "../components/ui/PageHeader";
import { Select } from "../components/ui/Select";
import type { Entry, Lexicon, ResearchCategory } from "../types";

function entryCountLabel(count: number): string {
  return count === 1 ? "1 entry" : `${count.toLocaleString()} entries`;
}

export function AnalyticsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<ResearchCategory[]>([]);
  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<CategorySortKey>("entries");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [e, cats, lex] = await Promise.all([
          fetchEntries(),
          fetchCategories(),
          fetchLexicon(),
        ]);
        if (cancelled) return;
        setEntries(e);
        setCategories(sortCategories(cats));
        setLexicon(lex);
      } catch {
        if (!cancelled) setError("Could not load analytics. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const overallStats = useMemo(
    () => computeCorpusStats(entries, showArchived, lexicon),
    [entries, showArchived, lexicon],
  );

  const rows = useMemo(
    () =>
      sortCategoryAnalytics(
        computeCategoryAnalytics(entries, categories, showArchived, lexicon),
        sortKey,
      ),
    [entries, categories, showArchived, lexicon, sortKey],
  );

  const hasAnyEntries = entries.some((e) => e.saved && e.archived === showArchived);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Compare masculine and feminine language across your research categories, side by side."
        action={
          <div className="flex sm:justify-end">
            <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer min-h-11 shrink-0">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="size-4 rounded border-line text-accent focus:ring-accent/30"
              />
              Show archived
            </label>
          </div>
        }
      />

      {error && (
        <p className="rounded-lg border border-danger/25 bg-danger-soft text-danger text-sm px-4 py-2.5">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted text-sm py-6">Loading analytics…</p>
      ) : !hasAnyEntries ? (
        <div className="rounded-lg border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
          <p className="font-medium text-ink">
            {showArchived ? "No archived entries" : "Nothing to analyze yet"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {showArchived
              ? "Archived entries will show up here once you have some."
              : "Save a few entries to see masculine/feminine breakdowns here."}
          </p>
          {!showArchived && (
            <Link to="/entry/new" className="btn btn-primary mt-4">
              New entry
            </Link>
          )}
        </div>
      ) : (
        <>
          <CorpusSummary
            stats={overallStats}
            showArchived={showArchived}
            categoryLabel="All categories combined"
          />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">Compare categories</h2>
              <div className="flex items-center gap-2">
                <label htmlFor="category-sort" className="text-xs font-medium text-muted">
                  Sort by
                </label>
                <Select
                  id="category-sort"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as CategorySortKey)}
                  className="min-h-10 py-2 w-auto"
                >
                  {CATEGORY_SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-surface/60 px-6 py-8 text-center">
                <p className="text-sm text-muted">
                  No categories have {showArchived ? "archived" : "saved"} entries yet.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {rows.map((row) => (
                  <li key={row.id} className="panel p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={`font-medium truncate ${row.isUncategorized ? "text-muted italic" : "text-ink"}`}
                          >
                            {row.name}
                          </p>
                          <span className="shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-xs text-muted tabular-nums">
                            {entryCountLabel(row.stats.entryCount)}
                          </span>
                          {row.stats.staleCount > 0 && (
                            <span className="shrink-0 text-xs text-warn-text">
                              {row.stats.staleCount} outdated
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-1 tabular-nums">
                          {row.stats.analyzedCount > 0
                            ? `${row.stats.totalWords.toLocaleString()} words analyzed`
                            : "No analyzed entries yet"}
                        </p>
                      </div>

                      {row.stats.analyzedCount > 0 && (
                        <GenderComparisonBar
                          masculinePercent={row.stats.masculinePercent!}
                          femininePercent={row.stats.femininePercent!}
                          size="sm"
                          className="shrink-0"
                        />
                      )}

                      <Link
                        to={`/?category=${encodeURIComponent(row.id)}`}
                        className="text-link text-sm shrink-0"
                      >
                        View entries →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
