import { Link, Outlet, useLocation } from "react-router-dom";

export function Layout() {
  const { pathname } = useLocation();
  const onLexicon = pathname === "/word-list";
  const onEntry = pathname.startsWith("/entry");

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper">
        <div className="mx-auto max-w-4xl px-5 py-3 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="font-serif text-[1.125rem] font-semibold text-ink tracking-tight hover:text-accent transition-colors duration-200"
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          >
            Gender Research
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium" aria-label="Main">
            <Link
              to="/"
              className={`rounded-md px-3 py-2 min-h-11 inline-flex items-center transition-colors duration-200 ${
                pathname === "/" && !onEntry
                  ? "text-ink bg-surface-hover"
                  : "text-muted hover:text-ink hover:bg-surface-hover"
              }`}
              style={{ transitionTimingFunction: "var(--ease-out)" }}
            >
              Entries
            </Link>
            <Link
              to="/word-list"
              className={`rounded-md px-3 py-2 min-h-11 inline-flex items-center transition-colors duration-200 ${
                onLexicon
                  ? "text-ink bg-surface-hover"
                  : "text-muted hover:text-ink hover:bg-surface-hover"
              }`}
              style={{ transitionTimingFunction: "var(--ease-out)" }}
            >
              Word list
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-4xl px-5 py-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
