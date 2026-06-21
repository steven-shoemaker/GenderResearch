import { useMemo, useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { CorpusSummary } from "../components/CorpusSummary";
import { ConfirmModal } from "../components/ConfirmModal";
import { EntriesTable } from "../components/EntriesTable";
import { Toast } from "../components/ui/Toast";
import {
  fetchBackupStatus,
  fetchEntries,
  fetchLexicon,
  restoreEntriesBackup,
  saveEntry,
  syncEntriesBackup,
} from "../lib/api-client";
import { computeCorpusStats } from "../lib/corpus-stats";
import { exportEntriesCsv } from "../lib/export-csv";
import { parseEntriesCsv } from "../lib/import-csv";
import { recomputeStaleEntries } from "../lib/recompute-entries";
import { entryTitle } from "../lib/entries";
import { PageHeader } from "../components/ui/PageHeader";
import type { Entry, Lexicon } from "../types";

function filterEntries(
  entries: Entry[],
  query: string,
  showArchived: boolean,
): Entry[] {
  let list = entries.filter((e) => e.saved && e.archived === showArchived);
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (e) =>
        entryTitle(e).toLowerCase().includes(q) ||
        e.company.toLowerCase().includes(q) ||
        (e.industry ?? "").toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q) ||
        e.bodyText.toLowerCase().includes(q),
    );
  }
  return list.sort(
    (a, b) =>
      new Date(b.capturedDate).getTime() - new Date(a.capturedDate).getTime(),
  );
}

export function CorpusPage() {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recomputingAll, setRecomputingAll] = useState(false);
  const [recomputeProgress, setRecomputeProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [recomputeMessage, setRecomputeMessage] = useState<{
    tone: "success" | "warn";
    text: string;
  } | null>(null);
  const [backupStatus, setBackupStatus] = useState<{
    lastSyncAt: string | null;
    rollingEntryCount: number;
    attachmentCount: number;
  } | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [backupToast, setBackupToast] = useState<string | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const reloadEntries = async () => {
    const e = await fetchEntries();
    setEntries(e);
    return e;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let entriesError: string | null = null;
      let lexiconError: string | null = null;
      try {
        const e = await fetchEntries();
        if (!cancelled) setEntries(e);
      } catch {
        entriesError = "Could not load entries. Check your connection and try again.";
      }
      try {
        const l = await fetchLexicon();
        if (!cancelled) setLexicon(l);
      } catch {
        lexiconError = "Could not load word list. Scores may be outdated until it reloads.";
      }
      if (!cancelled) {
        if (entriesError) setError(entriesError);
        else if (lexiconError) setError(lexiconError);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchBackupStatus();
        if (cancelled) return;
        setBackupStatus({
          lastSyncAt: status.lastSyncAt,
          rollingEntryCount: status.rollingEntryCount,
          attachmentCount: status.attachmentCount ?? 0,
        });
        const last = status.lastSyncAt ? Date.parse(status.lastSyncAt) : 0;
        const dayMs = 24 * 60 * 60 * 1000;
        if (entries.length > 0 && (!last || Date.now() - last > dayMs)) {
          const synced = await syncEntriesBackup();
          if (!cancelled) {
            setBackupStatus({
              lastSyncAt: synced.lastSyncAt,
              rollingEntryCount: synced.rollingEntryCount ?? synced.entryCount,
              attachmentCount: synced.attachmentCount ?? 0,
            });
          }
        }
      } catch {
        /* backup status is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries.length]);

  const visible = filterEntries(entries, search, showArchived);
  const corpusStats = useMemo(
    () => computeCorpusStats(entries, showArchived, lexicon),
    [entries, showArchived, lexicon],
  );

  const exportableCount = entries.filter(
    (e) => e.saved && e.archived === showArchived,
  ).length;

  const handleExportCsv = () => {
    exportEntriesCsv(entries, lexicon, { archivedOnly: showArchived });
  };

  const handleImportCsvClick = () => {
    csvInputRef.current?.click();
  };

  const handleImportCsvFile = async (file: File) => {
    if (!lexicon) {
      setError("Word list not loaded yet. Try again in a moment.");
      return;
    }
    setImportingCsv(true);
    setError(null);
    setBackupToast(null);
    try {
      const text = await file.text();
      const existingIds = new Set(entries.map((e) => e.id));
      const { imported, skipped, errors } = parseEntriesCsv(
        text,
        lexicon,
        existingIds,
      );
      if (imported.length === 0) {
        const detail = errors[0] ?? "No rows could be imported.";
        throw new Error(detail);
      }
      for (const entry of imported) {
        await saveEntry(entry);
      }
      await reloadEntries();
      const msg =
        imported.length === 1
          ? "Imported 1 entry from CSV."
          : `Imported ${imported.length} entries from CSV.`;
      const skipNote =
        skipped > 0 ? ` Skipped ${skipped} row${skipped === 1 ? "" : "s"}.` : "";
      setBackupToast(msg + skipNote);
      if (errors.length > 0 && skipped > 0) {
        console.warn("CSV import warnings:", errors);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV import failed.");
    } finally {
      setImportingCsv(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const handleDownloadJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      entries,
      lexicon,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gender-research-entries-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    setBackupToast(null);
    setError(null);
    try {
      const status = await syncEntriesBackup();
      setBackupStatus({
        lastSyncAt: status.lastSyncAt,
        rollingEntryCount: status.rollingEntryCount ?? status.entryCount,
        attachmentCount: status.attachmentCount ?? 0,
      });
      setBackupToast(
        status.attachmentCount
          ? `Backed up ${status.entryCount} entries and ${status.attachmentCount} PDF attachment copies.`
          : status.entryCount === 1
            ? "Backed up 1 entry to the cloud."
            : `Backed up ${status.entryCount} entries to the cloud.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup failed.");
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    setShowRestoreConfirm(false);
    setRestoring(true);
    setBackupToast(null);
    setError(null);
    try {
      const result = await restoreEntriesBackup("latest");
      await reloadEntries();
      setBackupToast(
        result.attachments
          ? `Restored ${result.restored} entries and ${result.attachments} PDF attachments.`
          : `Restored ${result.restored} entries from backup.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed.");
    } finally {
      setRestoring(false);
    }
  };

  const formatBackupTime = (iso: string | null) => {
    if (!iso) return "Never";
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const handleRecomputeAll = async () => {
    if (!lexicon || corpusStats.staleCount === 0) return;
    setRecomputingAll(true);
    setRecomputeMessage(null);
    setError(null);
    try {
      const { succeeded, failed } = await recomputeStaleEntries(
        entries,
        lexicon,
        showArchived,
        (done, total) => setRecomputeProgress({ done, total }),
      );

      if (succeeded.length > 0) {
        const byId = new Map(succeeded.map((e) => [e.id, e]));
        setEntries((prev) => prev.map((e) => byId.get(e.id) ?? e));
      }

      if (failed > 0 && succeeded.length > 0) {
        setRecomputeMessage({
          tone: "warn",
          text: `Updated ${succeeded.length} entries. ${failed} could not be saved.`,
        });
      } else if (failed > 0) {
        setRecomputeMessage({
          tone: "warn",
          text: "Could not recompute entries. Try again.",
        });
      } else if (succeeded.length > 0) {
        setRecomputeMessage({
          tone: "success",
          text:
            succeeded.length === 1
              ? "1 entry recomputed."
              : `${succeeded.length} entries recomputed.`,
        });
      }
    } catch {
      setRecomputeMessage({
        tone: "warn",
        text: "Recompute all failed. Try again.",
      });
    } finally {
      setRecomputingAll(false);
      setRecomputeProgress(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Entries"
        description="Paste job descriptions, analyze gendered language, and save your research."
        action={
          <div className="flex w-full flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <Link to="/entry/new" className="btn btn-primary">
                New entry
              </Link>
              <Link to="/import" className="btn btn-secondary">
                Import jobs
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line pt-3 sm:justify-end">
              <button
                type="button"
                onClick={() => void handleBackupNow()}
                disabled={loading || backingUp || restoring || recomputingAll || entries.length === 0}
                className="btn btn-secondary text-sm"
                title="Save a timestamped snapshot to cloud storage (entries, lexicon, and PDF attachments)"
              >
                {backingUp ? "Backing up…" : "Back up now"}
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                disabled={loading || entries.length === 0 || recomputingAll}
                className="btn btn-secondary text-sm"
                title="Download entries JSON to your computer (PDF files are not included — use Back up now for those)"
              >
                Download JSON
              </button>
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(true)}
                disabled={
                  loading ||
                  restoring ||
                  backingUp ||
                  recomputingAll ||
                  (backupStatus?.rollingEntryCount ?? 0) === 0
                }
                className="btn btn-secondary text-sm"
                title="Replace current entries with the latest cloud backup"
              >
                {restoring ? "Restoring…" : "Restore backup"}
              </button>
              <button
                type="button"
                onClick={handleImportCsvClick}
                disabled={loading || importingCsv || recomputingAll || !lexicon}
                className="btn btn-secondary text-sm"
                title="Import entries from a CSV with the same columns as Export CSV plus description"
              >
                {importingCsv ? "Importing…" : "Import CSV"}
              </button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportCsvFile(file);
                }}
              />
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={loading || exportableCount === 0 || recomputingAll || importingCsv}
                className="btn btn-secondary text-sm"
                title={
                  exportableCount === 0
                    ? "No entries to export"
                    : "Download collection as CSV"
                }
              >
                Export CSV
              </button>
            </div>
          </div>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1" role="search">
          <label htmlFor="search-entries" className="sr-only">
            Search entries
          </label>
          <input
            id="search-entries"
            type="search"
            placeholder="Search title, company, notes, or text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-input min-h-10 py-2"
            disabled={recomputingAll}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer min-h-10 shrink-0 px-1">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            disabled={recomputingAll}
            className="size-4 rounded border-line text-accent focus:ring-accent/30"
          />
          Show archived
        </label>
      </div>

      {backupToast && <Toast tone="success">{backupToast}</Toast>}

      {!loading && backupStatus && (
        <p className="text-xs text-muted -mt-2">
          Cloud backup: {formatBackupTime(backupStatus.lastSyncAt)}
          {backupStatus.rollingEntryCount > 0
            ? ` · ${backupStatus.rollingEntryCount} entries`
            : ""}
          {backupStatus.attachmentCount > 0
            ? ` · ${backupStatus.attachmentCount} PDF copies`
            : ""}
          {" · "}
          Auto-sync daily at 6:00 UTC and when you open Entries if older than 24h.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-danger/25 bg-danger-soft text-danger text-sm px-3 py-2">
          {error}
        </p>
      )}

      {recomputeMessage && (
        <Toast tone={recomputeMessage.tone === "success" ? "success" : "warn"}>
          {recomputeMessage.text}
        </Toast>
      )}

      {!loading && (
        <CorpusSummary
          stats={corpusStats}
          showArchived={showArchived}
          onRecomputeAll={
            lexicon && corpusStats.staleCount > 0 ? () => void handleRecomputeAll() : undefined
          }
          recomputingAll={recomputingAll}
          recomputeProgress={recomputeProgress}
        />
      )}

      {loading ? (
        <p className="text-muted text-sm py-6">Loading entries…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
          <p className="font-medium text-ink">
            {showArchived ? "No archived entries" : "Your research log is empty"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {showArchived
              ? "Archived entries will appear here."
              : "Start with a pasted job description."}
          </p>
          {!showArchived && (
            <Link to="/entry/new" className="btn btn-primary mt-4">
              New entry
            </Link>
          )}
        </div>
      ) : (
        <EntriesTable entries={visible} lexicon={lexicon} />
      )}

      {showRestoreConfirm && (
        <ConfirmModal
          title="Restore from backup?"
          message="This replaces all current entries with the latest cloud backup, including PDF attachments where available. Entries added after that backup will be lost unless you downloaded a JSON export."
          confirmLabel="Restore"
          destructive
          onConfirm={() => void handleRestore()}
          onCancel={() => setShowRestoreConfirm(false)}
        />
      )}
    </div>
  );
}
