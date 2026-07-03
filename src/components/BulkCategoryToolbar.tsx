import { useEffect, useMemo, useState } from "react";
import { Select } from "./ui/Select";
import { resolveOrCreateCategory, sortCategories } from "../lib/categories";
import type { ResearchCategory } from "../types";

interface BulkCategoryToolbarProps {
  selectedCount: number;
  categories: ResearchCategory[];
  onApply: (categoryId: string | null) => Promise<void> | void;
  onCreateCategory?: (category: ResearchCategory) => Promise<void> | void;
  onClearSelection: () => void;
  disabled?: boolean;
}

export function BulkCategoryToolbar({
  selectedCount,
  categories,
  onApply,
  onCreateCategory,
  onClearSelection,
  disabled = false,
}: BulkCategoryToolbarProps) {
  const [categoryId, setCategoryId] = useState<string>("");
  const [applying, setApplying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const sorted = useMemo(() => sortCategories(categories), [categories]);

  useEffect(() => {
    if (!categoryId && sorted[0]) {
      setCategoryId(sorted[0].id);
    }
  }, [categoryId, sorted]);

  if (selectedCount === 0) return null;

  const busy = disabled || applying || creatingCategory;

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(categoryId || null);
    } finally {
      setApplying(false);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || !onCreateCategory) return;
    setCreatingCategory(true);
    try {
      const { category, isNew } = resolveOrCreateCategory(name, categories);
      if (isNew) await onCreateCategory(category);
      setCategoryId(category.id);
      setNewName("");
      setCreating(false);
    } finally {
      setCreatingCategory(false);
    }
  };

  return (
    <div className="rounded-lg border border-accent/25 bg-accent-soft px-3 py-2.5 sm:px-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <p className="text-sm font-medium text-accent tabular-nums shrink-0">
        {selectedCount === 1 ? "1 entry selected" : `${selectedCount} entries selected`}
      </p>

      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        <label htmlFor="bulk-category" className="sr-only">
          Category for selected entries
        </label>
        <Select
          id="bulk-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={busy}
          className="min-h-10 py-2 flex-1 min-w-[10rem] max-w-xs"
        >
          <option value="">Uncategorized</option>
          {sorted.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={busy}
          className="btn btn-primary text-sm shrink-0"
        >
          {applying ? "Applying…" : "Apply category"}
        </button>

        {onCreateCategory && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={busy}
            className="btn btn-secondary text-sm shrink-0"
          >
            New category
          </button>
        )}

        <button
          type="button"
          onClick={onClearSelection}
          disabled={busy}
          className="btn btn-ghost text-sm shrink-0 sm:ml-auto"
        >
          Clear selection
        </button>
      </div>

      {creating && onCreateCategory && (
        <div className="flex flex-wrap gap-2 items-center w-full">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            disabled={busy}
            className="field-input min-h-10 py-2 flex-1 min-w-[10rem]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={busy || !newName.trim()}
            className="btn btn-primary text-sm"
          >
            {creatingCategory ? "Creating…" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            disabled={busy}
            className="btn btn-ghost text-sm"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
