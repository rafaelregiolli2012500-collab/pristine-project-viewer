// Basic in-memory fixed-window rate limit. In serverless each instance has its own
// memory, so this is a best-effort protection, not a global guarantee.
export function createRateLimiter(limit: number, windowMs = 60_000) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (key: string, now = Date.now()): boolean => {
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    const e = hits.get(key);
    if (!e || e.reset <= now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return true;
    }
    e.count++;
    return e.count <= limit;
  };
}
