import { useEffect, useState } from "react";
import { Link, useBlocker } from "react-router-dom";
import seedLexicon from "../../data/lexicon.seed.json";
import { fetchLexicon, saveLexicon } from "../lib/api-client";
import { ConfirmModal } from "../components/ConfirmModal";
import { PageHeader } from "../components/ui/PageHeader";
import { Toast } from "../components/ui/Toast";
import type { Lexicon } from "../types";

function cloneLexicon(lex: Lexicon): Lexicon {
  return {
    masculine: [...lex.masculine],
    feminine: [...lex.feminine],
    updatedAt: lex.updatedAt,
  };
}

export function LexiconPage() {
  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  const [savedLexicon, setSavedLexicon] = useState<Lexicon | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    fetchLexicon()
      .then((l) => {
        setLexicon(cloneLexicon(l));
        setSavedLexicon(l);
      })
      .catch(() => setError("Could not load word list."))
      .finally(() => setLoading(false));
  }, []);

  const dirty =
    lexicon &&
    savedLexicon &&
    (JSON.stringify(lexicon.masculine) !== JSON.stringify(savedLexicon.masculine) ||
      JSON.stringify(lexicon.feminine) !== JSON.stringify(savedLexicon.feminine));

  const blocker = useBlocker(Boolean(dirty));

  const updateRow = (
    column: "masculine" | "feminine",
    index: number,
    value: string,
  ) => {
    setLexicon((prev) => {
      if (!prev) return prev;
      const list = [...prev[column]];
      list[index] = value;
      return { ...prev, [column]: list };
    });
  };

  const addRow = (column: "masculine" | "feminine") => {
    setLexicon((prev) => (prev ? { ...prev, [column]: [...prev[column], ""] } : prev));
  };

  const removeRow = (column: "masculine" | "feminine", index: number) => {
    setLexicon((prev) =>
      prev
        ? { ...prev, [column]: prev[column].filter((_, i) => i !== index) }
        : prev,
    );
  };

  const saveWordList = async () => {
    if (!lexicon) return;
    setSaving(true);
    setError(null);
    try {
      const cleaned: Lexicon = {
        masculine: lexicon.masculine.map((s) => s.trim()).filter(Boolean),
        feminine: lexicon.feminine.map((s) => s.trim()).filter(Boolean),
        updatedAt: lexicon.updatedAt,
      };
      const saved = await saveLexicon(cleaned);
      setLexicon(cloneLexicon(saved));
      setSavedLexicon(saved);
      setToast("Word list saved. Recompute entries to update scores.");
      setTimeout(() => setToast(null), 4000);
    } catch {
      setError("Couldn't save word list. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const resetWordList = () => {
    const fresh: Lexicon = {
      masculine: [...seedLexicon.masculine],
      feminine: [...seedLexicon.feminine],
      updatedAt: new Date().toISOString(),
    };
    setLexicon(fresh);
    setConfirmReset(false);
  };

  const renderColumn = (column: "masculine" | "feminine", label: string) => {
    if (!lexicon) return null;
    const tone =
      column === "masculine"
        ? "border-masc-text/10 bg-masc-bg/30"
        : "border-fem-text/10 bg-fem-bg/30";
    return (
      <div className={`flex-1 min-w-0 panel p-4 sm:p-5 border ${tone}`}>
        <h2 className="text-base font-semibold text-ink mb-4">{label}</h2>
        <ul className="space-y-2 max-h-[min(32rem,50vh)] overflow-y-auto pr-1">
          {lexicon[column].map((row, i) => (
            <li key={`${column}-${i}`} className="flex gap-2">
              <input
                value={row}
                onChange={(e) => updateRow(column, i, e.target.value)}
                className="field-input flex-1 min-h-10 text-sm py-2"
                aria-label={`${label} pattern ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => removeRow(column, i)}
                className="text-danger text-lg leading-none px-2 min-h-10 rounded-md hover:bg-danger-soft transition-colors duration-200"
                style={{ transitionTimingFunction: "var(--ease-out)" }}
                aria-label={`Remove ${label} row ${i + 1}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => addRow(column)}
          className="mt-3 text-link text-sm min-h-11"
        >
          + Add pattern
        </button>
      </div>
    );
  };

  if (loading) {
    return <p className="text-muted text-sm py-8">Loading word list…</p>;
  }

  return (
    <div className="space-y-8 pb-24">
      <PageHeader
        title="Word list"
        description={
          <>
            <span className="font-medium text-ink">*</span> at the end means prefix match.
            Matching is case-insensitive.
          </>
        }
        back={
          <Link to="/" className="text-link text-sm min-h-11 inline-flex items-center">
            ← Entries
          </Link>
        }
      />

      {toast && <Toast tone="info">{toast}</Toast>}
      {error && (
        <p className="rounded-lg border border-danger/25 bg-danger-soft text-danger text-sm px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        {renderColumn("masculine", "Masculine")}
        {renderColumn("feminine", "Feminine")}
      </div>

      <div className="flex flex-wrap gap-3 items-center pt-2">
        <button
          type="button"
          onClick={() => void saveWordList()}
          disabled={!dirty || saving}
          className="btn btn-primary"
        >
          {saving ? "Saving…" : "Save word list"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="btn btn-ghost text-danger hover:text-danger"
        >
          Reset to default list
        </button>
        <p className="text-xs text-muted w-full leading-relaxed">
          Saved entries keep old scores until you recompute them.
        </p>
      </div>

      {confirmReset && (
        <ConfirmModal
          title="Reset word list?"
          message="This replaces your edits with the default research list. Click Save word list to store on the server."
          confirmLabel="Reset"
          destructive
          onConfirm={resetWordList}
          onCancel={() => setConfirmReset(false)}
        />
      )}

      {blocker.state === "blocked" && (
        <ConfirmModal
          title="Save changes to your word list?"
          message="You have unsaved edits."
          confirmLabel="Leave without saving"
          cancelLabel="Stay"
          destructive
          onConfirm={() => blocker.proceed?.()}
          onCancel={() => blocker.reset?.()}
        />
      )}
    </div>
  );
}
