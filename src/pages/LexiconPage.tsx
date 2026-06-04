import { useEffect, useState } from "react";
import { Link, useBlocker } from "react-router-dom";
import seedLexicon from "../../data/lexicon.seed.json";
import { fetchLexicon, saveLexicon } from "../lib/api-client";
import { ConfirmModal } from "../components/ConfirmModal";
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
    return (
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-ink mb-2">{label}</h2>
        <ul className="space-y-2">
          {lexicon[column].map((row, i) => (
            <li key={`${column}-${i}`} className="flex gap-2">
              <input
                value={row}
                onChange={(e) => updateRow(column, i, e.target.value)}
                className="flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm min-h-10"
              />
              <button
                type="button"
                onClick={() => removeRow(column, i)}
                className="text-red-600 text-xs px-2 min-h-10"
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
          className="mt-2 text-sm text-accent font-medium hover:underline min-h-11"
        >
          + Add pattern
        </button>
      </div>
    );
  };

  if (loading) {
    return <p className="text-muted text-sm">Loading word list…</p>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Word list</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="font-medium">*</span> at the end = prefix match. Matching is
            case-insensitive.
          </p>
        </div>
        <Link to="/" className="text-sm text-muted hover:text-accent min-h-11 inline-flex items-center">
          ← Entries
        </Link>
      </div>

      {toast && (
        <p className="rounded-lg bg-violet-50 border border-violet-200 text-violet-900 text-sm px-4 py-2">
          {toast}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {renderColumn("masculine", "Masculine")}
        {renderColumn("feminine", "Feminine")}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={() => void saveWordList()}
          disabled={!dirty || saving}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-900 disabled:opacity-40 min-h-11"
        >
          {saving ? "Saving…" : "Save word list"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="text-sm text-red-600 hover:underline min-h-11 px-2"
        >
          Reset to default list
        </button>
        <p className="text-xs text-muted w-full">
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
