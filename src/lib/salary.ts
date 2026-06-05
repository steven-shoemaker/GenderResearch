/** Parse optional salary input (GBP). Empty or invalid → null. */
export function parseSalaryGbp(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function formatSalaryGbp(value: number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}
