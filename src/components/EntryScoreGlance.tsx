import { formatPercent } from "../lib/analyze";

interface EntryScoreGlanceProps {
  masculinePercent: number;
  femininePercent: number;
}

/** % of gendered language (masc + fem) that fills the comparison track. */
const GENDERED_FULL_BAR = 12;

/**
 * Comparison track: fill length = how gendered the JD is; split = masc vs fem share.
 * True percentages shown under the bar.
 */
export function EntryScoreGlance({
  masculinePercent,
  femininePercent,
}: EntryScoreGlanceProps) {
  const masc = Math.max(0, masculinePercent);
  const fem = Math.max(0, femininePercent);
  const gendered = masc + fem;

  const fillPct =
    gendered > 0 ? Math.min(100, (gendered / GENDERED_FULL_BAR) * 100) : 0;
  const mascShare = gendered > 0 ? (masc / gendered) * 100 : 0;
  const femShare = gendered > 0 ? 100 - mascShare : 0;

  const label = `Masculine ${formatPercent(masc)}%, feminine ${formatPercent(fem)}%`;

  return (
    <div
      className="w-[8.5rem] sm:w-36 shrink-0"
      role="img"
      aria-label={label}
      title={label}
    >
      <div
        className="h-4 w-full rounded-md bg-surface-hover ring-1 ring-line overflow-hidden"
        aria-hidden
      >
        {fillPct > 0 && (
          <div
            className="flex h-full min-w-[4px]"
            style={{ width: `${fillPct}%` }}
          >
            {masc > 0 && (
              <span
                className="h-full bg-masc-text/80 min-w-[2px]"
                style={{ width: `${mascShare}%` }}
              />
            )}
            {fem > 0 && (
              <span
                className="h-full bg-fem-text/80 min-w-[2px]"
                style={{ width: `${femShare}%` }}
              />
            )}
          </div>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-1 tabular-nums">
        <span className="text-[0.6875rem] font-semibold text-masc-text leading-none">
          {formatPercent(masc)}%
        </span>
        <span className="text-[0.625rem] text-muted leading-none" aria-hidden>
          ·
        </span>
        <span className="text-[0.6875rem] font-semibold text-fem-text leading-none">
          {formatPercent(fem)}%
        </span>
      </div>
      <div className="mt-0.5 flex justify-between text-[0.5625rem] font-medium uppercase tracking-wide text-muted">
        <span>Masc.</span>
        <span>Fem.</span>
      </div>
    </div>
  );
}
