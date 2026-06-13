import "server-only";
import Redis from "ioredis";
import { logger } from "@/lib/logger";

/**
 * Redis is an accelerator, not a dependency: every helper degrades
 * gracefully (cache misses, in-memory rate limiting) when it is offline,
 * so the site keeps working in dev without docker compose.
 */
const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 2000, 30_000),
  });
  client.on("error", (error) => {
    logger.warn("redis_unavailable", { message: error.message });
  });
  return client;
}

export const redis = globalForRedis.redis ?? createRedis();
if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/** Read-through cache. Falls back to computing the value if Redis is down. */
export async function cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  if (redis) {
    try {
      const hit = await redis.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch {
      // fall through to compute
    }
  }
  const value = await compute();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // cache write is best-effort
    }
  }
  return value;
}

export async function invalidateCache(prefix: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // best-effort
  }
}

// In-memory fallback used when Redis is unreachable.
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Fixed-window rate limiter. Returns true when the action is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const redisKey = `ratelimit:${key}`;
  if (redis) {
    try {
      const count = await redis.incr(redisKey);
      if (count === 1) await redis.expire(redisKey, windowSeconds);
      return count <= limit;
    } catch {
      // fall through to memory
    }
  }
  const now = Date.now();
  const bucket = memoryBuckets.get(redisKey);
  if (!bucket || bucket.resetAt < now) {
    memoryBuckets.set(redisKey, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
