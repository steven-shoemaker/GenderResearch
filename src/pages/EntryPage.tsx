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
import { Field, TextArea, TextInput } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import { Toast } from "../components/ui/Toast";
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
    return <p className="text-muted text-sm py-12">Loading entry…</p>;
  }

  const canSave =
    preview && entry.bodyText.trim() && entry.analysis && !saving && lexicon;

  return (
    <div className="space-y-8 pb-28">
      <PageHeader
        title={
          preview ? (
            <>
              New entry{" "}
              <span className="text-base font-sans font-medium text-muted">(preview)</span>
            </>
          ) : (
            entryTitle(entry)
          )
        }
        back={
          <Link to="/" className="text-link text-sm min-h-11 inline-flex items-center">
            ← Entries
          </Link>
        }
      />

      {savedToast && <Toast tone="success">Entry saved</Toast>}

      {stale && (
        <div className="rounded-lg bg-warn-bg border border-warn-text/15 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-warn-text font-medium">Scores may be outdated.</p>
          <button
            type="button"
            onClick={() => void runRecompute()}
            disabled={recomputing}
            className="btn btn-warn shrink-0"
          >
            {recomputing ? "Recomputing…" : "Recompute entry"}
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-danger/25 bg-danger-soft text-danger text-sm px-4 py-2.5">
          {error}
        </p>
      )}

      {entry.analysis && <ScoreStrip analysis={entry.analysis} />}

      <section className="space-y-3">
        <Field
          label="Job description text"
          htmlFor="body-text"
          hint="Analysis uses pasted text only. You can attach a PDF later as a saved copy of the page."
        >
          <TextArea
            id="body-text"
            value={entry.bodyText}
            onChange={(e) => handleBodyChange(e.target.value)}
            rows={12}
            className="panel-inset text-[0.9375rem] leading-[1.65] min-h-[14rem] border-0 focus:ring-2"
            placeholder="Paste the full job description here…"
          />
        </Field>
      </section>

      {entry.analysis && (
        <HighlightedBody bodyText={entry.bodyText} matches={entry.analysis.matches} />
      )}

      <section className="pt-6 border-t border-line space-y-5">
        <h2 className="text-base font-semibold text-ink">Details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" htmlFor="title">
            <TextInput
              id="title"
              value={entry.title}
              onChange={(e) => void saveMetadata({ ...entry, title: e.target.value })}
            />
          </Field>
          <Field label="Company" htmlFor="company">
            <TextInput
              id="company"
              value={entry.company}
              onChange={(e) => void saveMetadata({ ...entry, company: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Source URL" htmlFor="source-url">
              <TextInput
                id="source-url"
                type="url"
                value={entry.sourceUrl}
                onChange={(e) => void saveMetadata({ ...entry, sourceUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          </div>
          <Field label="Captured date" htmlFor="captured-date">
            <TextInput
              id="captured-date"
              type="date"
              value={entry.capturedDate || todayIsoDate()}
              onChange={(e) =>
                void saveMetadata({ ...entry, capturedDate: e.target.value })
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes" htmlFor="notes">
              <TextArea
                id="notes"
                value={entry.notes}
                onChange={(e) => void saveMetadata({ ...entry, notes: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="pt-6 border-t border-line space-y-4">
        <div>
          <h2 className="text-base font-semibold text-ink">PDF snapshot</h2>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            {preview
              ? "PDFs upload when you save this entry."
              : "Stored in the cloud. Download anytime."}
          </p>
        </div>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-hover file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void queueOrUploadFile(f);
            e.target.value = "";
          }}
        />
        {uploading && <p className="text-xs text-muted">Uploading…</p>}
        <ul className="space-y-2">
          {pendingFiles.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-warn-bg/60 px-3 py-2.5 text-sm"
            >
              <span className="truncate">{p.file.name} (pending save)</span>
              <button
                type="button"
                onClick={() =>
                  setConfirm({ type: "removeAttachment", attachmentId: p.id, saved: false })
                }
                className="text-danger text-sm font-medium hover:underline min-h-11 px-2"
              >
                Remove
              </button>
            </li>
          ))}
          {entry.attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-hover px-3 py-2.5 text-sm"
            >
              <span className="truncate font-medium text-ink">{a.fileName}</span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => downloadAttachment(a)}
                  className="text-link text-sm min-h-11 px-2"
                >
                  Download attachment
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirm({ type: "removeAttachment", attachmentId: a.id, saved: true })
                  }
                  className="text-danger text-sm font-medium hover:underline min-h-11 px-2"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-paper">
        <div className="mx-auto max-w-4xl px-5 py-3 flex flex-wrap gap-2 justify-end">
          {preview && (
            <>
              <button
                type="button"
                onClick={() =>
                  dirtyPreview ? setConfirm({ type: "discard" }) : discard()
                }
                className="btn btn-ghost"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void runAnalyze()}
                disabled={analyzing || !entry.bodyText.trim() || !lexicon}
                className="btn btn-primary"
              >
                {analyzing ? "Analyzing…" : "Analyze"}
              </button>
              <button
                type="button"
                onClick={() => void saveEntryAction()}
                disabled={!canSave}
                title={!entry.analysis ? "Analyze before saving" : undefined}
                className="btn btn-secondary"
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
                className={stale ? "btn btn-primary" : "btn btn-secondary"}
              >
                {recomputing ? "Recomputing…" : "Recompute entry"}
              </button>
              {entry.archived ? (
                <button
                  type="button"
                  onClick={() => void restoreEntry()}
                  className="btn btn-ghost"
                >
                  Restore entry
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void archiveEntry()}
                  className="btn btn-ghost"
                >
                  Archive entry
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirm({ type: "delete" })}
                className="btn btn-ghost text-danger hover:text-danger"
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
