import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteCategory,
  fetchCategories,
  fetchEntries,
  renameCategory,
  saveCategories,
} from "../lib/api-client";
import { findCategoryByName, sortCategories, uniqueCategoryId } from "../lib/categories";
import { PageHeader } from "../components/ui/PageHeader";
import { Toast } from "../components/ui/Toast";
import type { Entry, ResearchCategory } from "../types";

function entryCountLabel(count: number): string {
  return count === 1 ? "1 entry" : `${count.toLocaleString()} entries`;
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<ResearchCategory[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ResearchCategory | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, es] = await Promise.all([fetchCategories(), fetchEntries()]);
        if (cancelled) return;
        setCategories(sortCategories(cats));
        setEntries(es);
      } catch {
        if (!cancelled) setError("Could not load categories.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let uncategorized = 0;
    for (const e of entries) {
      if (e.categoryId) counts.set(e.categoryId, (counts.get(e.categoryId) ?? 0) + 1);
      else uncategorized += 1;
    }
    return { byId: counts, uncategorized };
  }, [entries]);

  const handleAddCategory = async () => {
    const name = newName.trim();
    if (!name) return;
    const duplicate = findCategoryByName(categories, name);
    if (duplicate) {
      setAddError(`"${duplicate.name}" already exists.`);
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const category: ResearchCategory = {
        id: uniqueCategoryId(name, categories),
        name,
        createdAt: new Date().toISOString(),
      };
      const saved = await saveCategories(sortCategories([...categories, category]));
      setCategories(sortCategories(saved));
      setNewName("");
    } catch {
      setAddError("Could not add category. Try again.");
    } finally {
      setAdding(false);
    }
  };

  const startRename = (category: ResearchCategory) => {
    setRenamingId(category.id);
    setRenameValue(category.name);
    setRenameError(null);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
    setRenameError(null);
  };

  const confirmRename = async () => {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (!name) {
      setRenameError("Name cannot be empty.");
      return;
    }
    setRenaming(true);
    setRenameError(null);
    try {
      const updated = await renameCategory(renamingId, name);
      setCategories(sortCategories(updated));
      setRenamingId(null);
      setRenameValue("");
      setMessage("Category renamed.");
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : "Could not rename category.");
    } finally {
      setRenaming(false);
    }
  };

  const openDelete = (category: ResearchCategory) => {
    setDeleteTarget(category);
    setReassignTo("");
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteCategory(deleteTarget.id, reassignTo || null);
      setCategories(sortCategories(result.categories));
      const refreshed = await fetchEntries();
      setEntries(refreshed);
      const target = reassignTo
        ? result.categories.find((c) => c.id === reassignTo)?.name ?? "Uncategorized"
        : "Uncategorized";
      setMessage(
        result.reassignedCount > 0
          ? `Deleted "${deleteTarget.name}". ${entryCountLabel(result.reassignedCount)} moved to ${target}.`
          : `Deleted "${deleteTarget.name}".`,
      );
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete category.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteTargetCount = deleteTarget ? entryCounts.byId.get(deleteTarget.id) ?? 0 : 0;
  const reassignOptions = deleteTarget
    ? categories.filter((c) => c.id !== deleteTarget.id)
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Categories"
        description="Create, rename, and delete the research categories used to group and filter your entries (e.g. Sustainability vs another job focus)."
        back={
          <Link to="/" className="text-link text-sm min-h-11 inline-flex items-center">
            ← Entries
          </Link>
        }
      />

      {message && <Toast tone="success">{message}</Toast>}

      {error && (
        <p className="rounded-lg border border-danger/25 bg-danger-soft text-danger text-sm px-4 py-2.5">
          {error}
        </p>
      )}

      <section className="panel p-5 space-y-3">
        <h2 className="text-base font-semibold text-ink">Add category</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            disabled={adding}
            className="field-input min-h-11 flex-1 min-w-[12rem]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAddCategory();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void handleAddCategory()}
            disabled={adding || !newName.trim()}
            className="btn btn-primary shrink-0"
          >
            {adding ? "Adding…" : "Add category"}
          </button>
        </div>
        {addError && <p className="text-xs text-danger">{addError}</p>}
      </section>

      {loading ? (
        <p className="text-muted text-sm py-6">Loading categories…</p>
      ) : (
        <section className="panel overflow-hidden">
          <ul className="divide-y divide-line">
            {categories.length === 0 && (
              <li className="px-5 py-6 text-sm text-muted">No categories yet.</li>
            )}
            {categories.map((category) => {
              const count = entryCounts.byId.get(category.id) ?? 0;
              const isRenaming = renamingId === category.id;
              return (
                <li
                  key={category.id}
                  className="px-5 py-3.5 flex flex-wrap items-center gap-3 justify-between"
                >
                  {isRenaming ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        disabled={renaming}
                        autoFocus
                        className="field-input min-h-10 py-2 flex-1 min-w-[10rem]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void confirmRename();
                          }
                          if (e.key === "Escape") cancelRename();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void confirmRename()}
                        disabled={renaming || !renameValue.trim()}
                        className="btn btn-primary text-sm shrink-0"
                      >
                        {renaming ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        disabled={renaming}
                        className="btn btn-ghost text-sm shrink-0"
                      >
                        Cancel
                      </button>
                      {renameError && (
                        <p className="text-xs text-danger w-full">{renameError}</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate">{category.name}</p>
                        <p className="text-xs text-muted mt-0.5">{entryCountLabel(count)}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startRename(category)}
                          className="btn btn-secondary text-sm"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => openDelete(category)}
                          className="btn btn-ghost text-danger hover:text-danger text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
            {entryCounts.uncategorized > 0 && (
              <li className="px-5 py-3.5 flex items-center justify-between gap-3 bg-surface/60">
                <div>
                  <p className="font-medium text-muted">Uncategorized</p>
                  <p className="text-xs text-muted mt-0.5">
                    {entryCountLabel(entryCounts.uncategorized)}
                  </p>
                </div>
                <p className="text-xs text-muted">Not a category — assign entries to move them out.</p>
              </li>
            )}
          </ul>
        </section>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-ink/30"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-category-title"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="panel max-w-md w-full p-6 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-category-title"
              className="font-serif text-xl font-semibold text-ink"
            >
              Delete "{deleteTarget.name}"?
            </h2>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              {deleteTargetCount > 0
                ? `${entryCountLabel(deleteTargetCount)} currently use this category. Choose where to move ${
                    deleteTargetCount === 1 ? "it" : "them"
                  } before deleting.`
                : "No entries use this category. It can be safely deleted."}
            </p>

            {deleteTargetCount > 0 && (
              <div className="mt-4 space-y-1.5">
                <label
                  htmlFor="reassign-to"
                  className="block text-xs font-medium text-muted"
                >
                  Move entries to
                </label>
                <select
                  id="reassign-to"
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  disabled={deleting}
                  className="field-input min-h-10 py-2 w-full"
                >
                  <option value="">Uncategorized</option>
                  {reassignOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {deleteError && (
              <p className="mt-3 text-sm text-danger">{deleteError}</p>
            )}

            <div className="mt-7 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="btn bg-danger text-white hover:opacity-90"
              >
                {deleting ? "Deleting…" : "Delete category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
