import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Native select with the app's field styling plus a custom chevron (native arrows can't be restyled). */
export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`field-input appearance-none pr-9 ${props.disabled ? "" : "cursor-pointer"} ${className}`}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
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
    </div>
  );
}
