/**
 * Simple in-memory sliding-window rate limiter for server routes.
 *
 * This is per-isolate (each worker/dev process has its own counters), which is
 * a pragmatic improvement over nothing and works in dev and on both Vercel and
 * Cloudflare Workers. For a fully global counter across many isolates, swap in
 * a distributed backend (e.g. a Cloudflare `ratelimit` binding or a KV/DO
 * counter) — the call sites stay the same.
 */

const buckets = new Map<string, number[]>();

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Checks (and records) a request against a sliding window. Returns the number
 * of seconds the caller must wait before retrying when the limit is exceeded.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { allowed: true };
}

/** Builds a 429 response with a JSON body and `Retry-After` header. */
export function rateLimitedResponse(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({
      error: `Rate limit exceeded. Try again in ${retryAfterSeconds} second(s).`,
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
