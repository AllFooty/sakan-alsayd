import { getCloudflareContext } from '@opennextjs/cloudflare';

// Minimal structural type for the Cloudflare KV surface we use. Avoids pulling in
// @cloudflare/workers-types as a dependency just for this one file.
type RateLimitKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

const memoryMap = new Map<string, { count: number; resetAt: number }>();

async function getRateLimitKv(): Promise<RateLimitKv | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as { RATE_LIMIT_KV?: RateLimitKv }).RATE_LIMIT_KV ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the request should be blocked.
 *
 * Backed by Cloudflare KV (RATE_LIMIT_KV binding) in production. Falls back to
 * an in-memory Map when the binding is unavailable (e.g. `next dev` without
 * wrangler). The in-memory fallback is not reliable on Workers — each isolate
 * has its own Map — so production deployments must provision the KV binding.
 */
export async function isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const kv = await getRateLimitKv();

  if (kv) {
    const kvKey = `rl:${key}:${windowStart}`;
    const raw = await kv.get(kvKey);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    const next = count + 1;
    // KV has a 60s minimum TTL; add a 60s buffer so late reads still see the counter.
    const ttlSeconds = Math.max(60, Math.ceil(windowMs / 1000) + 60);
    await kv.put(kvKey, String(next), { expirationTtl: ttlSeconds });
    return next > limit;
  }

  const entry = memoryMap.get(key);
  if (!entry || now > entry.resetAt) {
    memoryMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}
