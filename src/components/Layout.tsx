import { Link, Outlet, useLocation } from "react-router-dom";

export function Layout() {
  const { pathname } = useLocation();
  const onLexicon = pathname === "/word-list";

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-stone-200/80 bg-paper/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="font-serif text-xl font-semibold text-ink hover:text-accent transition-colors"
          >
            Gender Research
          </Link>
          {!onLexicon && (
            <Link
              to="/word-list"
              className="text-sm font-medium text-muted hover:text-accent transition-colors"
            >
              Word list
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
