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
        ? "bg-masc-bg text-masc-text rounded px-0.5"
        : "bg-fem-bg text-fem-text rounded px-0.5";
    nodes.push(
      <mark key={`m-${m.start}`} className={`${cls} font-medium`}>
        {bodyText.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  }

  if (cursor < bodyText.length) {
    nodes.push(<span key={`t-end`}>{bodyText.slice(cursor)}</span>);
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-medium text-muted mb-3">Highlighted job description</h3>
      <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
        {nodes}
      </div>
    </div>
  );
}
