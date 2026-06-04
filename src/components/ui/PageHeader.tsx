import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  back?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  back,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-[1.75rem] sm:text-[2rem] font-semibold leading-tight text-ink tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted max-w-prose leading-relaxed">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:pt-1">
        {back}
        {action}
      </div>
    </header>
  );
}
