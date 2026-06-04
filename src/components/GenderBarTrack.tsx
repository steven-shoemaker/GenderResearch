import { genderedWordSplit } from "../lib/gender-comparison";

interface GenderBarTrackProps {
  masculinePercent: number;
  femininePercent: number;
  className?: string;
  title?: string;
}

/** Compact masculine/feminine split bar (gendered words only). */
export function GenderBarTrack({
  masculinePercent,
  femininePercent,
  className = "",
  title,
}: GenderBarTrackProps) {
  const masc = Math.max(0, masculinePercent);
  const fem = Math.max(0, femininePercent);
  const { mascShare, femShare, hasGendered } = genderedWordSplit(masc, fem);

  const label =
    title ??
    `Masculine ${masc}%, feminine ${fem}% of all words; bar is split among gendered words`;

  return (
    <div
      className={`h-2 w-full min-w-[3.5rem] max-w-[5.5rem] overflow-hidden rounded-sm ring-1 ring-line flex bg-surface-hover ${className}`.trim()}
      role="img"
      aria-label={label}
      title={label}
    >
      {hasGendered ? (
        <>
          {masc > 0 && (
            <span
              className="h-full gender-masc-bar min-w-px"
              style={{ width: `${mascShare}%` }}
            />
          )}
          {fem > 0 && (
            <span
              className="h-full gender-fem-bar min-w-px"
              style={{ width: `${femShare}%` }}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
