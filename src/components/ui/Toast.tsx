interface ToastProps {
  children: string;
  tone?: "success" | "info" | "warn";
}

const toneClass = {
  success: "bg-success-bg border-success-text/20 text-success-text",
  info: "bg-accent-soft border-accent/20 text-accent",
  warn: "bg-warn-bg border-warn-text/20 text-warn-text",
};

export function Toast({ children, tone = "info" }: ToastProps) {
  return (
    <p
      className={`rounded-lg border px-4 py-2.5 text-sm leading-snug ${toneClass[tone]}`}
      role="status"
    >
      {children}
    </p>
  );
}
