// Display helpers for AI spend (tokens + USD) shared by the leaderboard view
// and its chart.

/**
 * Gemini calls are cheap, so a fixed 2-decimal currency format would render
 * most real values as "$0.00". Precision therefore scales with magnitude.
 */
function usdFractionDigits(value: number): number {
  const abs = Math.abs(value);
  if (abs === 0) return 2;
  if (abs < 0.01) return 5;
  if (abs < 1) return 4;
  return 2;
}

export function formatUsd(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const digits = usdFractionDigits(safe);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safe);
}

/** Compact currency for tight spots (axis labels): "$1.2K". */
export function formatUsdCompact(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (Math.abs(safe) < 1000) return formatUsd(safe);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(safe);
}

export function formatTokens(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return new Intl.NumberFormat("es-DO").format(safe);
}

/** Compact token count for tight spots: "1.2M". */
export function formatTokensCompact(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  if (Math.abs(safe) < 1000) return String(safe);
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(safe);
}

// Day keys are plain "YYYY-MM-DD" strings with no timezone. Formatting them
// through UTC keeps the label on the same calendar day everywhere.
function dayKeyToUtcDate(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00Z`);
}

/** "24 jul" */
export function formatDayShort(dayKey: string): string {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(dayKeyToUtcDate(dayKey));
}

/** "vie, 24 de jul de 2026" */
export function formatDayLong(dayKey: string): string {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(dayKeyToUtcDate(dayKey));
}

/** "julio 2026" for a "YYYY-MM" key. */
export function formatMonthLong(monthKey: string): string {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(dayKeyToUtcDate(`${monthKey}-01`));
}

/**
 * Percentage change from `previous` to `current`.
 * Null when there is no baseline to compare against.
 */
export function percentDelta(
  current: number,
  previous: number,
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatPercentDelta(delta: number): string {
  const rounded = Math.abs(delta) >= 10 ? Math.round(delta) : Number(delta.toFixed(1));
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("es-DO", {
    maximumFractionDigits: 1,
  }).format(rounded)}%`;
}

/** Initials for an avatar chip, from a name or email. */
export function initialsFrom(label: string): string {
  return (
    label
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
