import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  back?: ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
  back,
}: PageHeaderProps) {
  return (
    <header className="space-y-4">
      <div className="min-w-0 space-y-1">
        <h1 className="font-serif text-[1.75rem] sm:text-[2rem] font-semibold leading-tight text-ink tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted max-w-prose leading-relaxed">{description}</p>
        )}
      </div>
      {(back || action) && (
        <div
          className={
            back
              ? "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              : "w-full"
          }
        >
          {back ? <div className="shrink-0">{back}</div> : null}
          {action ? (
            <div className={back ? "min-w-0 sm:flex sm:justify-end" : "w-full"}>
              {action}
            </div>
          ) : null}
        </div>
      )}
    </header>
  );
}
