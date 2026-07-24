// Calendar helpers for spend reporting.
//
// api_token_usage.created_at is stored in UTC, but "hoy" / "ayer" / "este mes"
// have to match the calendar the team actually works in — a scan at 9pm in
// Santo Domingo is already tomorrow in UTC. Everything here therefore buckets
// timestamps into *local* day keys ("YYYY-MM-DD") of a reporting timezone.
//
// Day keys are plain strings on purpose: they sort lexicographically, so range
// checks are `key >= startKey && key <= endKey` with no date math or DST edge
// cases at comparison time.

export const DEFAULT_REPORT_TIMEZONE = "America/Santo_Domingo";

const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || !timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function partsIn(date: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const out: Record<string, string> = {};
  for (const p of parts) out[p.type] = p.value;
  return out;
}

/** Local calendar day of `date` in `timeZone`, as "YYYY-MM-DD". */
export function localDayKey(date: Date, timeZone: string): string {
  const p = partsIn(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Offset (ms) to add to a UTC instant to get wall-clock time in `timeZone`. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  // Intl can render midnight as hour "24" in some locales/ICU versions.
  const hour = Number(p.hour) % 24;
  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hour,
    Number(p.minute),
    Number(p.second),
  );
  return asIfUtc - date.getTime();
}

/**
 * The UTC instant at which the local day `dayKey` starts in `timeZone`.
 * Two passes so days that begin on a DST transition resolve to the real
 * boundary instead of the offset that was in effect the day before.
 */
export function startOfLocalDayUtc(dayKey: string, timeZone: string): Date {
  const naive = Date.parse(`${dayKey}T00:00:00Z`);
  const firstGuess = naive - timeZoneOffsetMs(new Date(naive), timeZone);
  const corrected = naive - timeZoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(corrected);
}

/** `dayKey` moved by whole days. Uses UTC math so DST never shifts the result. */
export function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const moved = new Date(Date.UTC(y, (m ?? 1) - 1, d) + deltaDays * MS_PER_DAY);
  return `${moved.getUTCFullYear()}-${pad2(moved.getUTCMonth() + 1)}-${pad2(
    moved.getUTCDate(),
  )}`;
}

/** Inclusive list of day keys from `startKey` to `endKey`. */
export function dayKeyRange(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cursor = startKey;
  // Bounded so a bad input can never spin forever.
  for (let i = 0; cursor <= endKey && i < 1000; i++) {
    keys.push(cursor);
    cursor = shiftDayKey(cursor, 1);
  }
  return keys;
}

/** "YYYY-MM" of a day key. */
export function monthKeyOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

/** `monthKey` moved by whole months. */
export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const moved = new Date(Date.UTC(y, (m ?? 1) - 1 + deltaMonths, 1));
  return `${moved.getUTCFullYear()}-${pad2(moved.getUTCMonth() + 1)}`;
}

/** First day key of a month ("2026-07" → "2026-07-01"). */
export function firstDayOfMonthKey(monthKey: string): string {
  return `${monthKey}-01`;
}
