export type Bucket = { tokens: number; resetAt: number };

export const RATE_WINDOW_MS = 10 * 60 * 1000;
export const IP_LIMIT = 20;
export const GLOBAL_LIMIT = 60;

export function consumeRateLimit(
  buckets: Map<string, Bucket>,
  key: string,
  now: number,
  limit = IP_LIMIT,
  windowMs = RATE_WINDOW_MS,
): { ok: boolean; remaining: number } {
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { tokens: limit - 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (current.tokens <= 0) return { ok: false, remaining: 0 };
  current.tokens -= 1;
  return { ok: true, remaining: current.tokens };
}

export function allowRequest(
  buckets: Map<string, Bucket>,
  ip: string,
  now: number,
): boolean {
  const globalOk = consumeRateLimit(buckets, "__global__", now, GLOBAL_LIMIT);
  if (!globalOk.ok) return false;
  const ipOk = consumeRateLimit(buckets, `ip:${ip}`, now, IP_LIMIT);
  if (!ipOk.ok) return false;
  return true;
}
