import { formatPercent } from "../lib/analyze";
import { genderedWordSplit } from "../lib/gender-comparison";

export type GenderComparisonSize = "sm" | "lg";

interface GenderComparisonBarProps {
  /** Percent of all words that match masculine patterns. */
  masculinePercent: number;
  /** Percent of all words that match feminine patterns. */
  femininePercent: number;
  size?: GenderComparisonSize;
  showLegend?: boolean;
  className?: string;
}

const sizeClass = {
  sm: { root: "w-[9rem] sm:w-40", bar: "h-4", value: "text-[0.6875rem]" },
  lg: { root: "w-full", bar: "h-3.5", value: "text-2xl font-serif font-semibold leading-none" },
};

export function GenderComparisonBar({
  masculinePercent,
  femininePercent,
  size = "lg",
  showLegend = false,
  className = "",
}: GenderComparisonBarProps) {
  const masc = Math.max(0, masculinePercent);
  const fem = Math.max(0, femininePercent);
  const { mascShare, femShare, hasGendered } = genderedWordSplit(masc, fem);
  const s = sizeClass[size];
  const legendId = showLegend ? `gender-legend-${size}` : undefined;

  return (
    <figure className={`${s.root} ${className}`.trim()}>
      <div
        className={`w-full overflow-hidden rounded-md ring-1 ring-line ${s.bar} flex bg-surface-hover`}
        aria-hidden
      >
        {hasGendered ? (
          <>
            {masc > 0 && (
              <span
                className="h-full gender-masc-bar ring-1 ring-masc-text/15 min-w-[2px]"
                style={{ width: `${mascShare}%` }}
              />
            )}
            {fem > 0 && (
              <span
                className="h-full gender-fem-bar ring-1 ring-fem-text/15 min-w-[2px]"
                style={{ width: `${femShare}%` }}
              />
            )}
          </>
        ) : null}
      </div>

      <dl
        className={`mt-2 flex justify-between gap-3 tabular-nums ${size === "sm" ? "gap-2" : "sm:gap-8"}`}
        aria-describedby={legendId}
      >
        <div>
          <dt className="text-xs text-muted font-medium">Masculine</dt>
          <dd className={`${s.value} text-masc-text mt-0.5`}>
            {formatPercent(masc)}%
            <span className="sr-only"> of all words</span>
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-muted font-medium">Feminine</dt>
          <dd className={`${s.value} text-fem-text mt-0.5`}>
            {formatPercent(fem)}%
            <span className="sr-only"> of all words</span>
          </dd>
        </div>
      </dl>

      {showLegend && (
        <figcaption id={legendId} className="mt-2 text-xs text-muted leading-relaxed">
          Bar: masculine vs feminine among gendered words only. Percentages: share of
          all words in the text.
        </figcaption>
      )}
    </figure>
  );
}
