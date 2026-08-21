// A tiny in-process rate limiter for the unauthenticated endpoints.
//
// It is deliberately not a distributed one: the thing it has to stop is a script
// pointed at /api/auth/forgot-password walking a list of addresses, or grinding
// reset tokens, and a per-instance counter raises the cost of that by orders of
// magnitude for a few lines of code. Two honest limits:
//   - serverless instances don't share the map, so the real ceiling is
//     limit × instances;
//   - it resets on cold start.
// Both are fine here because the token itself is 256 bits — throttling is depth,
// not the defence. If the app ever needs a real quota, this is the seam: swap the
// body for Upstash/Redis and every caller keeps working.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so a long-lived instance can't grow the map without bound. */
function sweep(now: number) {
  if (buckets.size < 512) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/**
 * Count one hit against `key`. Returns whether it's allowed, and how long the
 * caller should wait if not.
 */
export function throttle(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  return { allowed: true, retryAfterMs: 0 };
}

/** Best-effort client address. Vercel sets x-forwarded-for; locally it's absent. */
export function clientIp(request: Request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
