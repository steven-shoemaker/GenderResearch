import { useEffect, useRef, useState } from "react";

export interface OverflowMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}

interface OverflowMenuProps {
  label?: string;
  items: OverflowMenuItem[];
  disabled?: boolean;
}

/** Collapses a set of secondary actions into a single button so the primary actions aren't lost in the crowd. */
export function OverflowMenu({ label = "More", items, disabled = false }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn btn-secondary text-sm"
      >
        {label}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`size-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M5.5 7.5L10 12l4.5-4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="panel absolute right-0 z-30 mt-2 w-60 overflow-hidden py-1.5"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              disabled={item.disabled}
              title={item.hint}
              className="flex w-full flex-col items-start px-4 py-2.5 text-left text-sm text-ink transition-colors duration-150 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
              style={{ transitionTimingFunction: "var(--ease-out)" }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
