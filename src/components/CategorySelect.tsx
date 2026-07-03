import { useMemo, useState } from "react";
import { Field } from "./ui/Field";
import { Select } from "./ui/Select";
import { resolveOrCreateCategory, sortCategories } from "../lib/categories";
import type { ResearchCategory } from "../types";

interface CategorySelectProps {
  categories: ResearchCategory[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  onCreateCategory?: (category: ResearchCategory) => Promise<void> | void;
  allowUncategorized?: boolean;
  disabled?: boolean;
  id?: string;
  label?: string;
  hint?: string;
}

export function CategorySelect({
  categories,
  value,
  onChange,
  onCreateCategory,
  allowUncategorized = true,
  disabled = false,
  id = "category",
  label = "Category",
  hint = "Group entries by research type (e.g. sustainability vs another job focus).",
}: CategorySelectProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const sorted = useMemo(() => sortCategories(categories), [categories]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || !onCreateCategory) return;
    setSaving(true);
    setCreateError(null);
    try {
      const { category, isNew } = resolveOrCreateCategory(name, categories);
      if (isNew) await onCreateCategory(category);
      onChange(category.id);
      setNewName("");
      setCreating(false);
    } catch {
      setCreateError("Could not create category.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Select
            id={id}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled || saving}
            className="min-h-10 py-2 flex-1 min-w-[12rem]"
          >
            {(allowUncategorized || sorted.length === 0) && (
              <option value="">Uncategorized</option>
            )}
            {sorted.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {onCreateCategory && (
            <button
              type="button"
              onClick={() => {
                setCreating((v) => !v);
                setCreateError(null);
              }}
              disabled={disabled || saving}
              className="btn btn-secondary text-sm shrink-0"
            >
              {creating ? "Cancel" : "New category"}
            </button>
          )}
        </div>

        {creating && onCreateCategory && (
          <div className="flex flex-wrap gap-2 items-start">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              disabled={disabled || saving}
              className="field-input min-h-10 py-2 flex-1 min-w-[12rem]"
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
              disabled={disabled || saving || !newName.trim()}
              className="btn btn-primary text-sm shrink-0"
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        )}

        {createError && (
          <p className="text-xs text-danger">{createError}</p>
        )}
      </div>
    </Field>
  );
}

interface CategoryFilterProps {
  categories: ResearchCategory[];
  value: string;
  onChange: (filter: string) => void;
  onCreateCategory?: (category: ResearchCategory) => Promise<void> | void;
  disabled?: boolean;
}

export function CategoryFilter({
  categories,
  value,
  onChange,
  onCreateCategory,
  disabled = false,
}: CategoryFilterProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => sortCategories(categories), [categories]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || !onCreateCategory) return;
    setSaving(true);
    try {
      const { category, isNew } = resolveOrCreateCategory(name, categories);
      if (isNew) await onCreateCategory(category);
      onChange(category.id);
      setNewName("");
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1 min-w-[12rem]">
        <label htmlFor="category-filter" className="block text-xs font-medium text-muted mb-1">
          Category
        </label>
        <Select
          id="category-filter"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || saving}
          className="min-h-10 py-2 w-full"
        >
          <option value="all">All categories (combined)</option>
          <option value="uncategorized">Uncategorized</option>
          {sorted.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {onCreateCategory && (
        <div className="flex flex-wrap gap-2 items-end">
          {creating ? (
            <>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New category"
                disabled={disabled || saving}
                className="field-input min-h-10 py-2 min-w-[10rem]"
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
                disabled={disabled || saving || !newName.trim()}
                className="btn btn-primary text-sm"
              >
                {saving ? "Creating…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
                disabled={saving}
                className="btn btn-ghost text-sm"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={disabled || saving}
              className="btn btn-secondary text-sm min-h-10"
            >
              New category
            </button>
          )}
        </div>
      )}
    </div>
  );
}
