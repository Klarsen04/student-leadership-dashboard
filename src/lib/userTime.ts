// Server-side helpers for computing day/week/month boundaries in the USER'S
// timezone rather than the server's. On Vercel the server runs in UTC, so
// naive startOfDay()-style math shifted every boundary by the user's UTC
// offset — a reflection saved yesterday evening local time landed on "today"
// and wrongly tripped the one-per-period guard, and streaks merged
// yesterday+today into one UTC day.
//
// `tzOffset` follows Date#getTimezoneOffset(): minutes, UTC minus local
// (e.g. 420 for PDT, -600 for AEST). Clients send it with requests.

const MIN = 60_000;
const DAY = 86_400_000;

/** A Date whose UTC fields equal the user's local wall clock. */
export function toUserClock(d: Date, tzOffset: number): Date {
  return new Date(d.getTime() - tzOffset * MIN);
}

/** "yyyy-MM-dd" of the instant in the user's local timezone. */
export function userDayKey(d: Date, tzOffset: number): string {
  return toUserClock(d, tzOffset).toISOString().slice(0, 10);
}

/** The user-local day key `daysAgo` days before `now`. */
export function userDayKeyAgo(now: Date, tzOffset: number, daysAgo: number): string {
  return userDayKey(new Date(now.getTime() - daysAgo * DAY), tzOffset);
}

export type PeriodType = "daily" | "weekly" | "monthly";

/**
 * UTC instants bounding the user-local day/week/month containing `now`.
 * Weeks start on Sunday, matching the client's date-fns usage.
 */
export function userPeriod(now: Date, tzOffset: number, type: PeriodType): { start: Date; end: Date } {
  const u = toUserClock(now, tzOffset);
  const y = u.getUTCFullYear(), m = u.getUTCMonth(), d = u.getUTCDate();
  let startMs: number, endMs: number;
  if (type === "weekly") {
    const dow = u.getUTCDay();
    startMs = Date.UTC(y, m, d - dow);
    endMs = Date.UTC(y, m, d - dow + 7);
  } else if (type === "monthly") {
    startMs = Date.UTC(y, m, 1);
    endMs = Date.UTC(y, m + 1, 1);
  } else {
    startMs = Date.UTC(y, m, d);
    endMs = Date.UTC(y, m, d + 1);
  }
  return {
    start: new Date(startMs + tzOffset * MIN),
    end: new Date(endMs + tzOffset * MIN - 1),
  };
}
