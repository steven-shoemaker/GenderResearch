import type { ReactNode } from "react";
import type { Match } from "../types";

interface HighlightedBodyProps {
  bodyText: string;
  matches: Match[];
}

export function HighlightedBody({ bodyText, matches }: HighlightedBodyProps) {
  if (!bodyText.trim()) return null;

  const sorted = [...matches].sort((a, b) => a.start - b.start);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const m of sorted) {
    if (m.start < cursor) continue;
    if (m.start > cursor) {
      nodes.push(
        <span key={`t-${cursor}`}>{bodyText.slice(cursor, m.start)}</span>,
      );
    }
    const cls =
      m.category === "masculine"
        ? "bg-masc-bg text-masc-text rounded-sm px-0.5 box-decoration-clone"
        : "bg-fem-bg text-fem-text rounded-sm px-0.5 box-decoration-clone";
    nodes.push(
      <mark key={`m-${m.start}`} className={`${cls} font-medium`}>
        {bodyText.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  }

  if (cursor < bodyText.length) {
    nodes.push(<span key="t-end">{bodyText.slice(cursor)}</span>);
  }

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line px-5 py-3 sm:px-6">
        <h2 className="text-sm font-semibold text-ink">Highlighted job description</h2>
        <p className="text-xs text-muted mt-0.5">
          Matched terms from your word list
        </p>
      </div>
      <div className="px-5 py-5 sm:px-6 max-h-[min(28rem,55vh)] overflow-y-auto">
        <div className="whitespace-pre-wrap text-[0.9375rem] leading-[1.7] text-ink max-w-prose">
          {nodes}
        </div>
      </div>
    </section>
  );
}
