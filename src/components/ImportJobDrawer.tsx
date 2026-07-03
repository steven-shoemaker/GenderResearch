import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ImportJobListing } from "../types";

interface ImportJobDrawerProps {
  job: ImportJobListing | null;
  imported: boolean;
  selected: boolean;
  importing: boolean;
  onClose: () => void;
  onToggleSelect: () => void;
}

function formatSalary(gbp: number | null): string {
  if (gbp == null) return "Not listed";
  return `£${gbp.toLocaleString("en-GB")} / year`;
}

function formatPosted(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-0.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink min-w-0">{children}</dd>
    </div>
  );
}

export function ImportJobDrawer({
  job,
  imported,
  selected,
  importing,
  onClose,
  onToggleSelect,
}: ImportJobDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!job) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    closeRef.current?.focus();
    return () => cancelAnimationFrame(frame);
  }, [job]);

  useEffect(() => {
    if (!job) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [job, onClose]);

  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Close preview"
        className={`absolute inset-0 bg-ink/30 transition-opacity duration-300 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-preview-title"
        className={`relative z-10 flex h-full w-full max-w-xl flex-col border-l border-line bg-paper shadow-[var(--shadow-panel)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[var(--ease-out)] ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="shrink-0 border-b border-line px-5 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">Job preview</p>
            <h2
              id="import-preview-title"
              className="font-serif text-xl font-semibold text-ink leading-snug mt-1"
            >
              {job.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="btn btn-ghost shrink-0 px-2 min-h-11"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <dl className="space-y-3">
            <MetaRow label="Company">{job.company || "—"}</MetaRow>
            <MetaRow label="Industry">{job.industry || "—"}</MetaRow>
            <MetaRow label="Source site">{job.sourceSite || "—"}</MetaRow>
            <MetaRow label="Location">{job.location || "—"}</MetaRow>
            <MetaRow label="Salary">{formatSalary(job.salaryGbp)}</MetaRow>
            <MetaRow label="Posted">{formatPosted(job.postedAt)}</MetaRow>
            {job.sourceUrl && (
              <MetaRow label="Posting">
                <a
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link break-all"
                >
                  View original posting
                </a>
              </MetaRow>
            )}
          </dl>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Job description</h3>
            <div className="panel-inset px-4 py-3 text-[0.9375rem] leading-[1.65] text-ink whitespace-pre-wrap max-h-[min(50vh,28rem)] overflow-y-auto">
              {job.description || (
                <p className="text-muted text-sm">No description available.</p>
              )}
            </div>
          </section>
        </div>

        <footer className="shrink-0 border-t border-line px-5 py-4 flex flex-wrap items-center justify-between gap-3 bg-paper">
          {imported ? (
            <p className="text-sm text-muted">Already in your corpus.</p>
          ) : (
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer min-h-11">
              <input
                type="checkbox"
                checked={selected}
                disabled={importing}
                onChange={onToggleSelect}
                className="checkbox"
              />
              Select for import
            </label>
          )}
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}
