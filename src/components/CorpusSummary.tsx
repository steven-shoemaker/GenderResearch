import { formatPercent } from "../lib/analyze";
import { formatCorpusStats, type CorpusStats } from "../lib/corpus-stats";

interface CorpusSummaryProps {
  stats: CorpusStats;
  showArchived: boolean;
}

export function CorpusSummary({ stats, showArchived }: CorpusSummaryProps) {
  if (stats.entryCount === 0) return null;

  const { entryLabel } = formatCorpusStats(stats);
  const hasScores =
    stats.analyzedCount > 0 &&
    stats.masculinePercent !== null &&
    stats.femininePercent !== null;

  return (
    <section
      className="panel px-5 py-4 sm:px-6 sm:py-5"
      aria-label="Collection summary"
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {showArchived ? "Archived collection" : "Collection"}
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-serif text-2xl font-semibold text-ink tabular-nums">
            {entryLabel}
          </p>
          {hasScores && (
            <p className="mt-1 text-sm text-muted tabular-nums">
              {stats.totalWords.toLocaleString()} words across{" "}
              {stats.analyzedCount === 1
                ? "1 analyzed entry"
                : `${stats.analyzedCount.toLocaleString()} analyzed entries`}
              {stats.analyzedCount < stats.entryCount && (
                <>
                  {" "}
                  ({stats.entryCount - stats.analyzedCount} without scores)
                </>
              )}
            </p>
          )}
        </div>
        {hasScores && (
          <dl className="flex gap-6 sm:gap-8 tabular-nums">
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Masculine %
              </dt>
              <dd className="font-serif text-2xl font-semibold text-masc-text">
                {formatPercent(stats.masculinePercent!)}%
              </dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Feminine %
              </dt>
              <dd className="font-serif text-2xl font-semibold text-fem-text">
                {formatPercent(stats.femininePercent!)}%
              </dd>
            </div>
          </dl>
        )}
      </div>
      {hasScores && (
        <p className="mt-3 text-xs text-muted leading-relaxed border-t border-line pt-3">
          Corpus-wide shares, weighted by word count in each saved job description.
          {stats.staleCount > 0 && (
            <>
              {" "}
              {stats.staleCount === 1
                ? "1 entry has"
                : `${stats.staleCount} entries have`}{" "}
              outdated scores; recompute to refresh.
            </>
          )}
        </p>
      )}
      {!hasScores && stats.entryCount > 0 && (
        <p className="mt-2 text-sm text-muted">
          Open an entry and run Analyze to build collection totals.
        </p>
      )}
    </section>
  );
}
