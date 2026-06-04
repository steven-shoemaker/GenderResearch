import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import {
  deleteAttachment,
  fetchEntry,
  fetchLexicon,
  removeEntry,
  saveEntry as apiSaveEntry,
  uploadAttachment,
} from "../lib/api-client";
import { analyzeText } from "../lib/analyze";
import { createPreviewEntry, entryTitle } from "../lib/entries";
import { entryIsStale, todayIsoDate } from "../lib/utils";
import { ConfirmModal } from "../components/ConfirmModal";
import { HighlightedBody } from "../components/HighlightedBody";
import { ScoreStrip } from "../components/ScoreStrip";
import type { AttachmentMeta, Entry, Lexicon } from "../types";

interface PendingFile {
  id: string;
  file: File;
}

export function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [entry, setEntry] = useState<Entry | null>(null);
  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [confirm, setConfirm] = useState<
    | null
    | { type: "discard" }
    | { type: "delete" }
    | { type: "removeAttachment"; attachmentId: string; saved: boolean }
  >(null);

  useEffect(() => {
    fetchLexicon()
      .then(setLexicon)
      .catch(() => setError("Could not load word list."));
  }, []);

  useEffect(() => {
    if (isNew) {
      setEntry(createPreviewEntry());
      setLoading(false);
      return;
    }
    if (!id) return;
    setLoading(true);
    fetchEntry(id)
      .then(setEntry)
      .catch(() => navigate("/", { replace: true }))
      .finally(() => setLoading(false));
  }, [id, isNew, navigate]);

  const dirtyPreview = useMemo(() => {
    if (!entry || entry.saved) return false;
    return (
      entry.bodyText.trim().length > 0 ||
      entry.title.trim().length > 0 ||
      pendingFiles.length > 0 ||
      entry.attachments.length > 0
    );
  }, [entry, pendingFiles]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyPreview && currentLocation.pathname !== nextLocation.pathname,
  );

  const stale =
    entry && entry.saved && lexicon ? entryIsStale(entry, lexicon) : false;
  const preview = entry ? !entry.saved : true;

  const persistLocal = useCallback((next: Entry) => {
    setEntry(next);
  }, []);

  const runAnalyze = async () => {
    if (!entry || !lexicon) return;
    if (!entry.bodyText.trim()) {
      setError("Paste job description text first.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      const analysis = analyzeText(entry.bodyText, lexicon);
      persistLocal({
        ...entry,
        analysis,
        bodyDirty: false,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      setError("Analysis failed. Check the text and try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const runRecompute = async () => {
    if (!entry?.saved || !lexicon) return;
    setRecomputing(true);
    setError(null);
    try {
      const analysis = analyzeText(entry.bodyText, lexicon);
      const next: Entry = {
        ...entry,
        analysis,
        bodyDirty: false,
        updatedAt: new Date().toISOString(),
      };
      const saved = await apiSaveEntry(next);
      setEntry(saved);
    } catch {
      setError("Recompute failed. Try again.");
    } finally {
      setRecomputing(false);
    }
  };

  const flushPendingUploads = async (entryId: string) => {
    for (const p of pendingFiles) {
      await uploadAttachment(entryId, p.file);
    }
    setPendingFiles([]);
    const refreshed = await fetchEntry(entryId);
    setEntry(refreshed);
  };

  const saveEntryAction = async () => {
    if (!entry?.analysis) return;
    setSaving(true);
    setError(null);
    try {
      const toSave: Entry = {
        ...entry,
        saved: true,
        updatedAt: new Date().toISOString(),
      };
      const saved = await apiSaveEntry(toSave);
      if (pendingFiles.length > 0) {
        await flushPendingUploads(saved.id);
      } else {
        setEntry(saved);
      }
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
      navigate(`/entry/${saved.id}`, { replace: true });
    } catch {
      setError("Couldn't save this entry. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleBodyChange = (text: string) => {
    if (!entry) return;
    persistLocal({
      ...entry,
      bodyText: text,
      bodyDirty: true,
      updatedAt: new Date().toISOString(),
    });
  };

  const saveMetadata = async (next: Entry) => {
    persistLocal(next);
    if (next.saved) {
      try {
        const saved = await apiSaveEntry(next);
        setEntry(saved);
      } catch {
        setError("Couldn't save details. Try again.");
      }
    }
  };

  const queueOrUploadFile = async (file: File) => {
    if (!entry) return;
    if (!entry.saved) {
      setPendingFiles((prev) => [...prev, { id: crypto.randomUUID(), file }]);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const meta = await uploadAttachment(entry.id, file);
      setEntry((e) =>
        e
          ? {
              ...e,
              attachments: [...e.attachments, meta],
              updatedAt: new Date().toISOString(),
            }
          : e,
      );
    } catch {
      setError("Upload failed. Check the file and try again.");
    } finally {
      setUploading(false);
    }
  };

  const downloadAttachment = (meta: AttachmentMeta) => {
    window.open(meta.url, "_blank", "noopener,noreferrer");
  };

  const removePending = (pendingId: string) => {
    setPendingFiles((prev) => prev.filter((p) => p.id !== pendingId));
    setConfirm(null);
  };

  const removeSavedAttachment = async (attachmentId: string) => {
    if (!entry) return;
    try {
      await deleteAttachment(entry.id, attachmentId);
      const refreshed = await fetchEntry(entry.id);
      setEntry(refreshed);
    } catch {
      setError("Could not remove attachment.");
    }
    setConfirm(null);
  };

  const discard = () => {
    navigate("/");
    setConfirm(null);
  };

  const archiveEntry = async () => {
    if (!entry?.saved) return;
    try {
      await apiSaveEntry({
        ...entry,
        archived: true,
        updatedAt: new Date().toISOString(),
      });
      navigate("/");
    } catch {
      setError("Could not archive entry.");
    }
  };

  const restoreEntry = async () => {
    if (!entry?.saved) return;
    try {
      const saved = await apiSaveEntry({
        ...entry,
        archived: false,
        updatedAt: new Date().toISOString(),
      });
      setEntry(saved);
    } catch {
      setError("Could not restore entry.");
    }
  };

  const deleteCurrent = async () => {
    if (!entry) return;
    try {
      await removeEntry(entry.id);
      navigate("/");
    } catch {
      setError("Could not delete entry.");
    }
  };

  if (loading || !entry) {
    return <p className="text-muted text-sm">Loading entry…</p>;
  }

  const canSave =
    preview && entry.bodyText.trim() && entry.analysis && !saving && lexicon;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between gap-4">
        <div>
          {preview && (
            <span className="text-xs font-medium uppercase tracking-wide text-accent">
              Preview
            </span>
          )}
          <h1 className="font-serif text-2xl font-semibold text-ink">
            {preview ? "New entry" : entryTitle(entry)}
          </h1>
        </div>
        <Link to="/" className="text-sm text-muted hover:text-accent min-h-11 inline-flex items-center">
          ← Entries
        </Link>
      </div>

      {savedToast && (
        <p className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-2">
          Entry saved
        </p>
      )}

      {stale && (
        <div className="rounded-xl bg-warn-bg border border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-warn-text">Scores may be outdated.</p>
          <button
            type="button"
            onClick={() => void runRecompute()}
            disabled={recomputing}
            className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-700 disabled:opacity-60 min-h-11"
          >
            {recomputing ? "Recomputing…" : "Recompute entry"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {entry.analysis && <ScoreStrip analysis={entry.analysis} />}

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <label htmlFor="body-text" className="block text-sm font-medium text-ink mb-2">
          Job description text
        </label>
        <p className="text-xs text-muted mb-3">
          Paste the job description here. Analysis uses pasted text only. Attach a PDF as a
          saved copy of the page (stored in the cloud when you save).
        </p>
        <textarea
          id="body-text"
          value={entry.bodyText}
          onChange={(e) => handleBodyChange(e.target.value)}
          rows={10}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y min-h-[200px]"
          placeholder="Paste job description from LinkedIn…"
        />
      </div>

      {entry.analysis && (
        <HighlightedBody bodyText={entry.bodyText} matches={entry.analysis.matches} />
      )}

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-medium text-ink">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              value={entry.title}
              onChange={(e) => void saveMetadata({ ...entry, title: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm min-h-11"
            />
          </div>
          <div>
            <label className="text-xs text-muted" htmlFor="company">
              Company
            </label>
            <input
              id="company"
              value={entry.company}
              onChange={(e) => void saveMetadata({ ...entry, company: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm min-h-11"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted" htmlFor="source-url">
              Source URL
            </label>
            <input
              id="source-url"
              type="url"
              value={entry.sourceUrl}
              onChange={(e) => void saveMetadata({ ...entry, sourceUrl: e.target.value })}
              placeholder="https://…"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm min-h-11"
            />
          </div>
          <div>
            <label className="text-xs text-muted" htmlFor="captured-date">
              Captured date
            </label>
            <input
              id="captured-date"
              type="date"
              value={entry.capturedDate || todayIsoDate()}
              onChange={(e) =>
                void saveMetadata({ ...entry, capturedDate: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm min-h-11"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              value={entry.notes}
              onChange={(e) => void saveMetadata({ ...entry, notes: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm resize-y"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-ink mb-2">PDF snapshot</h2>
        <p className="text-xs text-muted mb-3">
          {preview
            ? "PDFs upload when you save this entry."
            : "Stored in cloud storage — download anytime."}
        </p>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void queueOrUploadFile(f);
            e.target.value = "";
          }}
        />
        {uploading && <p className="text-xs text-muted mt-2">Uploading…</p>}
        <ul className="mt-3 space-y-2">
          {pendingFiles.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm"
            >
              <span className="truncate">{p.file.name} (pending save)</span>
              <button
                type="button"
                onClick={() => setConfirm({ type: "removeAttachment", attachmentId: p.id, saved: false })}
                className="text-red-600 hover:underline min-h-11 px-2"
              >
                Remove
              </button>
            </li>
          ))}
          {entry.attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm"
            >
              <span className="truncate">{a.fileName}</span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => downloadAttachment(a)}
                  className="font-medium text-accent hover:underline min-h-11 px-2"
                >
                  Download attachment
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirm({ type: "removeAttachment", attachmentId: a.id, saved: true })
                  }
                  className="text-red-600 hover:underline min-h-11 px-2"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-3 flex flex-wrap gap-2 justify-end">
          {preview && (
            <>
              <button
                type="button"
                onClick={() =>
                  dirtyPreview ? setConfirm({ type: "discard" }) : discard()
                }
                className="px-4 py-2.5 text-sm font-medium text-muted hover:text-ink min-h-11"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void runAnalyze()}
                disabled={analyzing || !entry.bodyText.trim() || !lexicon}
                className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-violet-900 disabled:opacity-50 min-h-11"
              >
                {analyzing ? "Analyzing…" : "Analyze"}
              </button>
              <button
                type="button"
                onClick={() => void saveEntryAction()}
                disabled={!canSave}
                title={!entry.analysis ? "Analyze before saving" : undefined}
                className="px-5 py-2.5 rounded-lg border border-accent text-accent text-sm font-semibold hover:bg-violet-50 disabled:opacity-40 min-h-11"
              >
                {saving ? "Saving…" : "Save entry"}
              </button>
            </>
          )}
          {!preview && (
            <>
              <button
                type="button"
                onClick={() => void runRecompute()}
                disabled={recomputing || !lexicon}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold min-h-11 ${
                  stale
                    ? "bg-accent text-white hover:bg-violet-900"
                    : "border border-stone-300 text-ink hover:bg-stone-50"
                } disabled:opacity-50`}
              >
                {recomputing ? "Recomputing…" : "Recompute entry"}
              </button>
              {entry.archived ? (
                <button
                  type="button"
                  onClick={() => void restoreEntry()}
                  className="px-4 py-2.5 text-sm text-muted hover:text-ink min-h-11"
                >
                  Restore entry
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void archiveEntry()}
                  className="px-4 py-2.5 text-sm text-muted hover:text-ink min-h-11"
                >
                  Archive entry
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirm({ type: "delete" })}
                className="px-4 py-2.5 text-sm text-red-600 hover:text-red-800 min-h-11"
              >
                Delete entry
              </button>
            </>
          )}
        </div>
      </div>

      {confirm?.type === "discard" && (
        <ConfirmModal
          title="Discard this entry?"
          message="Unsaved text will be lost."
          confirmLabel="Discard"
          destructive
          onConfirm={discard}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === "delete" && (
        <ConfirmModal
          title="Delete this entry?"
          message="This cannot be undone. PDFs in storage will be removed."
          confirmLabel="Delete entry"
          destructive
          onConfirm={() => void deleteCurrent()}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === "removeAttachment" && (
        <ConfirmModal
          title="Remove attachment?"
          message="The file will be removed."
          confirmLabel="Remove"
          destructive
          onConfirm={() =>
            confirm.saved
              ? void removeSavedAttachment(confirm.attachmentId)
              : removePending(confirm.attachmentId)
          }
          onCancel={() => setConfirm(null)}
        />
      )}

      {blocker.state === "blocked" && (
        <ConfirmModal
          title="Discard this entry?"
          message="You have unsaved changes."
          confirmLabel="Leave"
          destructive
          onConfirm={() => blocker.proceed?.()}
          onCancel={() => blocker.reset?.()}
        />
      )}
    </div>
  );
}
