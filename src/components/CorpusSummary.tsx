import { GenderComparisonBar } from "./GenderComparisonBar";
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
    <section className="panel px-5 py-5 sm:px-6 sm:py-6" aria-label="Collection summary">
      <h2 className="text-sm font-semibold text-ink">
        {showArchived ? "Archived collection" : "Your collection"}
      </h2>

      <p className="mt-1 font-serif text-2xl font-semibold text-ink tabular-nums">
        {entryLabel}
      </p>

      {hasScores && (
        <p className="mt-1 text-sm text-muted tabular-nums leading-relaxed">
          {stats.totalWords.toLocaleString()} words across{" "}
          {stats.analyzedCount === 1
            ? "1 analyzed entry"
            : `${stats.analyzedCount.toLocaleString()} analyzed entries`}
          {stats.analyzedCount < stats.entryCount && (
            <> ({stats.entryCount - stats.analyzedCount} without scores)</>
          )}
        </p>
      )}

      {hasScores && (
        <div className="mt-5">
          <GenderComparisonBar
            masculinePercent={stats.masculinePercent!}
            femininePercent={stats.femininePercent!}
            size="lg"
            showLegend
          />
        </div>
      )}

      {hasScores && stats.staleCount > 0 && (
        <p className="mt-3 text-xs text-warn-text leading-relaxed">
          {stats.staleCount === 1 ? "1 entry has" : `${stats.staleCount} entries have`}{" "}
          outdated scores. Open the entry and recompute to refresh collection totals.
        </p>
      )}

      {!hasScores && stats.entryCount > 0 && (
        <p className="mt-3 text-sm text-muted leading-relaxed">
          Open an entry and run Analyze to build collection totals.
        </p>
      )}
    </section>
  );
}
