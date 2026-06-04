import { formatPercent } from "../lib/analyze";
import { formatCorpusStats, type CorpusStats } from "../lib/corpus-stats";
import { GenderBarTrack } from "./GenderBarTrack";

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
          {showArchived ? "Archived" : "Collection"} · bar = gendered-word mix · % =
          all words
        </span>
      </div>
      {hasScores && stats.staleCount > 0 && (
        <p className="mt-2 text-xs text-warn-text">
          {stats.staleCount === 1 ? "1 entry has" : `${stats.staleCount} have`}{" "}
          outdated scores.
        </p>
      )}
      {!hasScores && (
        <p className="mt-1 text-xs text-muted">Analyze entries to see totals.</p>
      )}
    </section>
  );
}
