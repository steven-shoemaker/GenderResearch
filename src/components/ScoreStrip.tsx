import type { AnalysisResult } from "../types";
import { formatPercent } from "../lib/analyze";
import { GenderComparisonBar } from "./GenderComparisonBar";

interface ScoreStripProps {
  analysis: AnalysisResult;
}

export function ScoreStrip({ analysis }: ScoreStripProps) {
  return (
    <section
      className="panel p-5 sm:p-6 space-y-5"
      aria-live="polite"
      aria-label="Analysis scores"
    >
      <GenderComparisonBar
        masculinePercent={analysis.masculinePercent}
        femininePercent={analysis.femininePercent}
        size="lg"
        showLegend
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 tabular-nums border-t border-line pt-5 text-sm">
        <div>
          <p className="text-muted">Masculine matches</p>
          <p className="mt-0.5 font-medium text-ink">{analysis.masculineCount}</p>
        </div>
        <div>
          <p className="text-muted">Feminine matches</p>
          <p className="mt-0.5 font-medium text-ink">{analysis.feminineCount}</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-muted">Words in text</p>
          <p className="mt-0.5 font-medium text-ink">
            {analysis.totalWordCount.toLocaleString()}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted sr-only">
        Masculine {formatPercent(analysis.masculinePercent)} percent, feminine{" "}
        {formatPercent(analysis.femininePercent)} percent of words.
      </p>
    </section>
  );
}
