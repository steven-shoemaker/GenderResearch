import { Link } from "react-router-dom";
import { formatPercent } from "../lib/analyze";
import { categoryNameById } from "../lib/categories";
import { entryTitle } from "../lib/entries";
import { entryIsStale } from "../lib/utils";
import { GenderBarTrack } from "./GenderBarTrack";
import type { Entry, Lexicon, ResearchCategory } from "../types";

function formatCapturedDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface EntriesTableProps {
  entries: Entry[];
  lexicon: Lexicon | null;
  categories?: ResearchCategory[];
}

export function EntriesTable({ entries, lexicon, categories = [] }: EntriesTableProps) {
  return (
    <div className="panel overflow-hidden flex flex-col min-h-0">
      <div className="overflow-auto max-h-[min(28rem,58vh)] overscroll-contain">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-surface shadow-[0_1px_0_var(--color-line)]">
            <tr className="text-left text-xs font-medium text-muted">
              <th scope="col" className="py-2.5 pl-4 pr-2 font-medium">
                Title
              </th>
              <th scope="col" className="py-2.5 px-2 font-medium hidden sm:table-cell">
                Company
              </th>
              <th scope="col" className="py-2.5 px-2 font-medium hidden md:table-cell">
                Category
              </th>
              <th scope="col" className="py-2.5 px-2 font-medium whitespace-nowrap">
                Date
              </th>
              <th
                scope="col"
                className="py-2.5 px-2 font-medium text-right tabular-nums whitespace-nowrap"
              >
                Words
              </th>
              <th
                scope="col"
                className="py-2.5 px-2 font-medium text-right tabular-nums whitespace-nowrap"
              >
                Masc.
              </th>
              <th
                scope="col"
                className="py-2.5 px-2 font-medium text-right tabular-nums whitespace-nowrap"
              >
                Fem.
              </th>
              <th scope="col" className="py-2.5 pl-2 pr-4 font-medium w-[5.5rem]">
                <span className="sr-only">Gendered word mix</span>
                <span aria-hidden>Mix</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((entry) => {
              const stale = lexicon ? entryIsStale(entry, lexicon) : false;
              const a = entry.analysis;
              const title = entryTitle(entry);

              return (
                <tr
                  key={entry.id}
                  className="group hover:bg-surface-hover motion-safe:transition-colors motion-safe:duration-150"
                >
                  <td className="py-2 pl-4 pr-2 min-w-0">
                    <Link
                      to={`/entry/${entry.id}`}
                      className="block min-w-0 font-medium text-ink group-hover:text-accent truncate"
                    >
                      <span className="inline-flex items-center gap-1.5 max-w-full">
                        {stale && (
                          <span
                            className="shrink-0 size-1.5 rounded-full bg-warn-text"
                            title="Scores outdated"
                            aria-label="Scores outdated"
                          />
                        )}
                        <span className="truncate">{title}</span>
                      </span>
                    </Link>
                    {entry.company && (
                      <p className="sm:hidden text-xs text-muted truncate mt-0.5">
                        {entry.company}
                      </p>
                    )}
                  </td>
                  <td className="py-2 px-2 hidden sm:table-cell text-muted max-w-[8rem]">
                    <Link to={`/entry/${entry.id}`} className="block truncate">
                      {entry.company || "—"}
                    </Link>
                  </td>
                  <td className="py-2 px-2 hidden md:table-cell text-muted max-w-[8rem]">
                    <Link to={`/entry/${entry.id}`} className="block truncate">
                      {categoryNameById(categories, entry.categoryId)}
                    </Link>
                  </td>
                  <td className="py-2 px-2 text-muted tabular-nums whitespace-nowrap">
                    <Link to={`/entry/${entry.id}`} className="block">
                      {formatCapturedDate(entry.capturedDate)}
                    </Link>
                  </td>
                  <td className="py-2 px-2 text-right text-muted tabular-nums whitespace-nowrap">
                    <Link to={`/entry/${entry.id}`} className="block">
                      {a ? a.totalWordCount.toLocaleString() : "—"}
                    </Link>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                    <Link
                      to={`/entry/${entry.id}`}
                      className={`block font-medium ${a ? "text-masc-text" : "text-muted"}`}
                    >
                      {a ? `${formatPercent(a.masculinePercent)}%` : "—"}
                    </Link>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                    <Link
                      to={`/entry/${entry.id}`}
                      className={`block font-medium ${a ? "text-fem-text" : "text-muted"}`}
                    >
                      {a ? `${formatPercent(a.femininePercent)}%` : "—"}
                    </Link>
                  </td>
                  <td className="py-2 pl-2 pr-4 align-middle">
                    <Link
                      to={`/entry/${entry.id}`}
                      className="flex justify-end"
                      aria-label={`${title}: open entry`}
                    >
                      {a ? (
                        <GenderBarTrack
                          masculinePercent={a.masculinePercent}
                          femininePercent={a.femininePercent}
                        />
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
