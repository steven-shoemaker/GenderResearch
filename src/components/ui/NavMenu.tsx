import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

interface NavMenuItem {
  to: string;
  label: string;
}

interface NavMenuProps {
  label: string;
  items: NavMenuItem[];
}

/** Groups secondary nav destinations behind one trigger so the top-level nav doesn't grow unbounded. */
export function NavMenu({ label, items }: NavMenuProps) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = items.some((item) => item.to === pathname);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
        aria-haspopup="menu"
        aria-expanded={open}
        className={`rounded-md px-3 py-2 min-h-11 inline-flex items-center gap-1 transition-colors duration-200 ${
          active ? "text-ink bg-surface-hover" : "text-muted hover:text-ink hover:bg-surface-hover"
        }`}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
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
        <div role="menu" className="panel absolute right-0 z-30 mt-2 w-44 overflow-hidden py-1.5">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              className={`block px-4 py-2.5 text-sm transition-colors duration-150 ${
                pathname === item.to ? "text-ink bg-surface-hover" : "text-ink hover:bg-surface-hover"
              }`}
              style={{ transitionTimingFunction: "var(--ease-out)" }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
