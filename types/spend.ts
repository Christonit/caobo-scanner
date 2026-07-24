// Shared contract for AI spend reporting: the shape /api/usage/leaderboard
// returns and the /leaderboard view consumes.

/** Reporting windows. Rolling ranges include today. */
export const SPEND_RANGE_KEYS = [
  "today",
  "yesterday",
  "last5",
  "last7",
  "last15",
  "last30",
  "thisMonth",
  "lastMonth",
] as const;

export type SpendRangeKey = (typeof SPEND_RANGE_KEYS)[number];

export interface SpendBucket {
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  calls: number;
}

/** Who spent it. Null id / names mean the auth user no longer resolves. */
export interface SpendActor {
  userId: string | null;
  name: string | null;
  email: string | null;
}

export type SpendLeaderboardRow = SpendActor & Record<SpendRangeKey, SpendBucket>;

export type SpendDayActor = SpendActor & SpendBucket;

export interface SpendDay extends SpendBucket {
  /** Local calendar day, "YYYY-MM-DD". */
  date: string;
  byUser: SpendDayActor[];
}

export interface SpendLeaderboardResponse {
  role: "admin" | "superadmin";
  organizationId: string;
  /** IANA timezone the days were bucketed in. */
  timezone: string;
  generatedAt: string;
  /** True when the window hit the row cap, so totals may be partial. */
  truncated: boolean;
  window: { startDate: string; endDate: string };
  rollingStartDate: string;
  clients: { id: string; name: string }[];
  hasUnassignedClient: boolean;
  totals: Record<SpendRangeKey, SpendBucket>;
  /** Zero-filled daily series for the rolling window, oldest first. */
  days: SpendDay[];
  leaderboard: SpendLeaderboardRow[];
}

/** One bar in SpendBarChart. */
export interface SpendBarPoint {
  /** Stable key (the day key). */
  key: string;
  /** Axis label, e.g. "24 jul". */
  label: string;
  /** Full label for the tooltip, e.g. "vie, 24 de jul de 2026". */
  tooltipLabel?: string;
  value: number;
  /** Secondary tooltip line, e.g. token or call counts. */
  caption?: string;
}
