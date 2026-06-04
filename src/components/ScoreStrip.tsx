import type { AnalysisResult } from "../types";
import { formatPercent } from "../lib/analyze";

interface ScoreStripProps {
  analysis: AnalysisResult;
}

export function ScoreStrip({ analysis }: ScoreStripProps) {
  const mascPct = analysis.masculinePercent;
  const femPct = analysis.femininePercent;
  const neutralPct = Math.max(0, 100 - mascPct - femPct);

  return (
    <section
      className="panel p-5 sm:p-6"
      aria-live="polite"
      aria-label="Analysis scores"
    >
      <div className="flex flex-col gap-5">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-hover flex">
          <span
            className="h-full bg-masc-bg transition-[width] duration-300"
            style={{
              width: `${mascPct}%`,
              transitionTimingFunction: "var(--ease-out)",
            }}
            title={`Masculine ${formatPercent(mascPct)}%`}
          />
          <span
            className="h-full bg-fem-bg transition-[width] duration-300"
            style={{
              width: `${femPct}%`,
              transitionTimingFunction: "var(--ease-out)",
            }}
            title={`Feminine ${formatPercent(femPct)}%`}
          />
          {neutralPct > 0.5 && (
            <span
              className="h-full bg-transparent"
              style={{ width: `${neutralPct}%` }}
              aria-hidden
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 tabular-nums">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
              Masculine %
            </p>
            <p className="mt-1 font-serif text-3xl font-semibold text-masc-text leading-none">
              {formatPercent(analysis.masculinePercent)}%
            </p>
            <p className="mt-1 text-xs text-muted">
              {analysis.masculineCount} match{analysis.masculineCount === 1 ? "" : "es"}
            </p>
          </div>
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
              Feminine %
            </p>
            <p className="mt-1 font-serif text-3xl font-semibold text-fem-text leading-none">
              {formatPercent(analysis.femininePercent)}%
            </p>
            <p className="mt-1 text-xs text-muted">
              {analysis.feminineCount} match{analysis.feminineCount === 1 ? "" : "es"}
            </p>
          </div>
          <div className="col-span-2 flex flex-col justify-end gap-2 text-sm text-muted sm:pl-2">
            <p>{analysis.totalWordCount.toLocaleString()} words in pasted text</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-2">
                <span
                  className="size-3 rounded-sm bg-masc-bg ring-1 ring-masc-text/15"
                  aria-hidden
                />
                Masculine
              </span>
              <span className="inline-flex items-center gap-2">
                <span
                  className="size-3 rounded-sm bg-fem-bg ring-1 ring-fem-text/15"
                  aria-hidden
                />
                Feminine
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
