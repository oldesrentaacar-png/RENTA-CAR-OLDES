type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const store = new Map<string, RateLimitEntry>();

const DEFAULT_OPTIONS: RateLimitOptions = {
  limit: 20,
  windowMs: 60_000,
};

function cleanupExpired(now: number): void {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  options: Partial<RateLimitOptions> = {},
): RateLimitResult {
  const { limit, windowMs } = { ...DEFAULT_OPTIONS, ...options };
  const now = Date.now();

  if (store.size > 10_000) {
    cleanupExpired(now);
  }

  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  store.set(key, existing);

  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}

export function getClientIp(
  headers: Headers,
  fallback: string = "unknown",
): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || fallback;
  }
  return headers.get("x-real-ip")?.trim() || fallback;
}

export function buildRateLimitKey(
  ip: string,
  scope: string,
  identifier?: string,
): string {
  return [scope, ip, identifier].filter(Boolean).join(":");
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

export function resetAllRateLimits(): void {
  store.clear();
}
