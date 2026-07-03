import { useMemo, useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BulkCategoryToolbar } from "../components/BulkCategoryToolbar";
import { CorpusSummary } from "../components/CorpusSummary";
import { CategoryFilter as CategoryFilterBar } from "../components/CategorySelect";
import { ConfirmModal } from "../components/ConfirmModal";
import { EntriesTable } from "../components/EntriesTable";
import { OverflowMenu } from "../components/ui/OverflowMenu";
import { Toast } from "../components/ui/Toast";
import {
  fetchBackupStatus,
  fetchCategories,
  fetchEntries,
  fetchLexicon,
  restoreEntriesBackup,
  importEntries,
  saveCategories,
  syncEntriesBackup,
} from "../lib/api-client";
import {
  ALL_CATEGORIES_FILTER,
  categoryNameById,
  entryMatchesCategoryFilter,
  sortCategories,
  UNCATEGORIZED_FILTER,
  type CategoryFilter,
} from "../lib/categories";
import { bulkAssignCategory } from "../lib/bulk-categories";
import { computeCorpusStats } from "../lib/corpus-stats";
import { exportEntriesCsv } from "../lib/export-csv";
import { parseEntriesCsv, csvImportExistingFromEntries } from "../lib/import-csv";
import { recomputeStaleEntries } from "../lib/recompute-entries";
import { entryTitle } from "../lib/entries";
import { PageHeader } from "../components/ui/PageHeader";
import type { Entry, Lexicon, ResearchCategory } from "../types";

function filterEntries(
  entries: Entry[],
  query: string,
  showArchived: boolean,
  categoryFilter: CategoryFilter,
): Entry[] {
  let list = entries.filter(
    (e) =>
      e.saved &&
      e.archived === showArchived &&
      entryMatchesCategoryFilter(e, categoryFilter),
  );
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [categoryFilter, setCategoryFilterState] = useState<CategoryFilter>(
    () => searchParams.get("category") || ALL_CATEGORIES_FILTER,
  );

  /** Keeps the URL deep-linkable (e.g. from Analytics' "View entries" links). */
  const setCategoryFilter = (value: CategoryFilter) => {
    setCategoryFilterState(value);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === ALL_CATEGORIES_FILTER) next.delete("category");
        else next.set("category", value);
        return next;
      },
      { replace: true },
    );
  };
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<ResearchCategory[]>([]);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{
    tone: "success" | "warn";
    text: string;
  } | null>(null);
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
      try {
        const c = await fetchCategories();
        if (!cancelled) setCategories(sortCategories(c));
      } catch {
        if (!entriesError && !lexiconError) {
          setError("Could not load categories.");
        }
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

  useEffect(() => {
    setSelectedIds(new Set());
  }, [showArchived, categoryFilter]);

  const visible = filterEntries(entries, search, showArchived, categoryFilter);
  const corpusStats = useMemo(
    () => computeCorpusStats(entries, showArchived, lexicon, categoryFilter),
    [entries, showArchived, lexicon, categoryFilter],
  );

  const categoryLabel = useMemo(() => {
    if (categoryFilter === ALL_CATEGORIES_FILTER) return "All categories (combined)";
    if (categoryFilter === UNCATEGORIZED_FILTER) return "Uncategorized";
    return categoryNameById(categories, categoryFilter);
  }, [categoryFilter, categories]);

  const handleCreateCategory = async (category: ResearchCategory) => {
    const next = sortCategories([...categories, category]);
    const saved = await saveCategories(next);
    setCategories(sortCategories(saved));
  };

  const toggleEntrySelection = (entryId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const visibleIds = visible.map((e) => e.id);
      const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  };

  const handleBulkAssignCategory = async (categoryId: string | null) => {
    if (selectedIds.size === 0) return;
    setBulkAssigning(true);
    setBulkMessage(null);
    setError(null);
    try {
      const { updated, failed } = await bulkAssignCategory(
        entries,
        selectedIds,
        categoryId,
      );
      if (updated.length > 0) {
        const byId = new Map(updated.map((e) => [e.id, e]));
        setEntries((prev) => prev.map((e) => byId.get(e.id) ?? e));
        setSelectedIds(new Set());
        const label = categoryId
          ? categoryNameById(categories, categoryId)
          : "Uncategorized";
        setBulkMessage({
          tone: "success",
          text:
            updated.length === 1
              ? `1 entry moved to ${label}.`
              : `${updated.length} entries moved to ${label}.`,
        });
      }
      if (failed > 0) {
        setBulkMessage({
          tone: "warn",
          text: "Could not update selected entries. Try again.",
        });
      }
    } catch {
      setError("Bulk category update failed.");
    } finally {
      setBulkAssigning(false);
    }
  };

  const exportableCount = entries.filter(
    (e) =>
      e.saved &&
      e.archived === showArchived &&
      entryMatchesCategoryFilter(e, categoryFilter),
  ).length;

  const handleExportCsv = () => {
    const pool = entries.filter(
      (e) =>
        e.saved &&
        e.archived === showArchived &&
        entryMatchesCategoryFilter(e, categoryFilter),
    );
    exportEntriesCsv(pool, lexicon, {
      archivedOnly: showArchived,
      categories,
    });
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
      const existing = csvImportExistingFromEntries(entries);
      const { imported, skipped, errors } = parseEntriesCsv(
        text,
        lexicon,
        existing,
        categories,
      );
      if (imported.length === 0) {
        const detail =
          skipped > 0
            ? `All ${skipped} row${skipped === 1 ? "" : "s"} already in your corpus (matched by entry_id or source_url).`
            : errors[0] ?? "No rows could be imported.";
        throw new Error(detail);
      }
      const { added, total } = await importEntries(imported);
      await reloadEntries();
      const msg =
        added === 1
          ? `Imported 1 entry from CSV (${total} total).`
          : `Imported ${added} entries from CSV (${total} total).`;
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
      categories,
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
        categoryFilter,
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
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Link to="/entry/new" className="btn btn-primary">
              New entry
            </Link>
            <Link to="/import" className="btn btn-secondary">
              Import jobs
            </Link>
            <OverflowMenu
              disabled={loading}
              items={[
                {
                  label: backingUp ? "Backing up…" : "Back up now",
                  onClick: () => void handleBackupNow(),
                  disabled: backingUp || restoring || recomputingAll || entries.length === 0,
                  hint: "Save a timestamped snapshot to cloud storage (entries, lexicon, and PDF attachments)",
                },
                {
                  label: "Download JSON",
                  onClick: handleDownloadJson,
                  disabled: entries.length === 0 || recomputingAll,
                  hint: "Download entries JSON to your computer (PDF files are not included — use Back up now for those)",
                },
                {
                  label: restoring ? "Restoring…" : "Restore backup",
                  onClick: () => setShowRestoreConfirm(true),
                  disabled:
                    restoring ||
                    backingUp ||
                    recomputingAll ||
                    (backupStatus?.rollingEntryCount ?? 0) === 0,
                  hint: "Replace current entries with the latest cloud backup",
                },
                {
                  label: importingCsv ? "Importing…" : "Import CSV",
                  onClick: handleImportCsvClick,
                  disabled: importingCsv || recomputingAll || !lexicon,
                  hint: "Import entries from a CSV with the same columns as Export CSV plus description",
                },
                {
                  label: "Export CSV",
                  onClick: handleExportCsv,
                  disabled: exportableCount === 0 || recomputingAll || importingCsv,
                  hint: exportableCount === 0 ? "No entries to export" : "Download collection as CSV",
                },
              ]}
            />
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
          </div>
        }
      />

      <div className="panel flex flex-col gap-3 p-3 sm:p-4">
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
              className="checkbox"
            />
            Show archived
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <CategoryFilterBar
            categories={categories}
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value as CategoryFilter)}
            onCreateCategory={handleCreateCategory}
            disabled={loading || recomputingAll}
          />
          <div className="flex items-center gap-3 text-xs shrink-0 sm:ml-auto">
            <Link to="/analytics" className="text-link">
              Compare categories
            </Link>
            <Link to="/categories" className="text-link">
              Manage categories
            </Link>
          </div>
        </div>
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

      {bulkMessage && (
        <Toast tone={bulkMessage.tone === "success" ? "success" : "warn"}>
          {bulkMessage.text}
        </Toast>
      )}

      {!loading && (
        <CorpusSummary
          stats={corpusStats}
          showArchived={showArchived}
          categoryFilter={categoryFilter}
          categoryLabel={categoryLabel}
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
        <div className="space-y-3">
          <BulkCategoryToolbar
            selectedCount={selectedIds.size}
            categories={categories}
            onApply={handleBulkAssignCategory}
            onCreateCategory={handleCreateCategory}
            onClearSelection={() => setSelectedIds(new Set())}
            disabled={bulkAssigning || recomputingAll || importingCsv}
          />
          <EntriesTable
            entries={visible}
            lexicon={lexicon}
            categories={categories}
            selectedIds={selectedIds}
            onToggleOne={toggleEntrySelection}
            onToggleAll={toggleAllVisible}
            selectionDisabled={bulkAssigning || recomputingAll || importingCsv}
          />
        </div>
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
