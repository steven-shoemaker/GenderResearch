import { formatPercent } from "../lib/analyze";
import { formatCorpusStats, type CorpusStats } from "../lib/corpus-stats";
import { GenderBarTrack } from "./GenderBarTrack";
import type { CategoryFilter } from "../lib/categories";

interface CorpusSummaryProps {
  stats: CorpusStats;
  showArchived: boolean;
  categoryFilter?: CategoryFilter;
  categoryLabel?: string;
  onRecomputeAll?: () => void;
  recomputingAll?: boolean;
  recomputeProgress?: { done: number; total: number } | null;
}

export function CorpusSummary({
  stats,
  showArchived,
  categoryFilter = "all",
  categoryLabel,
  onRecomputeAll,
  recomputingAll = false,
  recomputeProgress = null,
}: CorpusSummaryProps) {
  if (stats.entryCount === 0) return null;

  const { entryLabel } = formatCorpusStats(stats);
  const hasScores =
    stats.analyzedCount > 0 &&
    stats.masculinePercent !== null &&
    stats.femininePercent !== null;

  const recomputeLabel =
    recomputingAll && recomputeProgress
      ? `Recomputing ${recomputeProgress.done} of ${recomputeProgress.total}…`
      : stats.staleCount === 1
        ? "Recompute 1 entry"
        : `Recompute all (${stats.staleCount})`;

  return (
    <section
      className="rounded-lg border border-line bg-surface px-3 py-2.5 sm:px-4"
      aria-label="Collection summary"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-medium text-ink tabular-nums">{entryLabel}</span>
        {hasScores && (
          <>
            <span className="text-muted tabular-nums">
              {stats.totalWords.toLocaleString()} words
            </span>
            <span className="text-masc-text font-medium tabular-nums">
              {formatPercent(stats.masculinePercent!)}% masculine
            </span>
            <span className="text-fem-text font-medium tabular-nums">
              {formatPercent(stats.femininePercent!)}% feminine
            </span>
            <GenderBarTrack
              masculinePercent={stats.masculinePercent!}
              femininePercent={stats.femininePercent!}
              className="max-w-[4.5rem]"
            />
          </>
        )}
        <span className="text-xs text-muted w-full sm:w-auto sm:ml-auto">
          {showArchived ? "Archived" : "Collection"}
          {categoryLabel ? ` · ${categoryLabel}` : categoryFilter !== "all" ? "" : " · all categories"}
          {" · bar = gendered-word mix · % = all words"}
        </span>
      </div>

      {stats.staleCount > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-xs text-warn-text flex-1 min-w-[12rem]">
            {stats.staleCount === 1
              ? "1 entry has outdated scores (edited text or word list changed)."
              : `${stats.staleCount} entries have outdated scores.`}
          </p>
          {onRecomputeAll && (
            <button
              type="button"
              onClick={onRecomputeAll}
              disabled={recomputingAll}
              className="btn btn-warn text-xs px-3 py-1.5 min-h-9 shrink-0"
            >
              {recomputeLabel}
            </button>
          )}
        </div>
      )}

      {!hasScores && stats.staleCount === 0 && (
        <p className="mt-1 text-xs text-muted">Analyze entries to see totals.</p>
      )}
    </section>
  );
}
