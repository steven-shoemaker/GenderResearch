import type { AnalysisResult } from "../types";
import { formatPercent } from "../lib/analyze";

interface ScoreStripProps {
  analysis: AnalysisResult;
}

export function ScoreStrip({ analysis }: ScoreStripProps) {
  return (
    <div
      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
      aria-live="polite"
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 tabular-nums">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Masculine %
          </p>
          <p className="text-2xl font-semibold text-masc-text">
            {formatPercent(analysis.masculinePercent)}%
          </p>
          <p className="text-xs text-muted">{analysis.masculineCount} matches</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Feminine %
          </p>
          <p className="text-2xl font-semibold text-fem-text">
            {formatPercent(analysis.femininePercent)}%
          </p>
          <p className="text-xs text-muted">{analysis.feminineCount} matches</p>
        </div>
        <div className="col-span-2 sm:col-span-2 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>{analysis.totalWordCount} words total</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-masc-bg border border-masc-text/20" />
            Masculine
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-fem-bg border border-fem-text/20" />
            Feminine
          </span>
        </div>
      </div>
    </div>
  );
}
