interface RateBucket {
  timestamps: number[];
}

declare global {
  var __afustaRateLimitStore: Map<string, RateBucket> | undefined;
}

const store = globalThis.__afustaRateLimitStore ?? new Map<string, RateBucket>();
globalThis.__afustaRateLimitStore = store;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  nowMs = Date.now()
): RateLimitResult {
  const cutoff = nowMs - windowMs;
  const existing = store.get(key);
  const recent = existing ? existing.timestamps.filter((t) => t > cutoff) : [];

  if (recent.length >= maxRequests) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    store.set(key, { timestamps: recent });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  recent.push(nowMs);
  store.set(key, { timestamps: recent });

  if (store.size > 5000) {
    for (const [k, bucket] of store.entries()) {
      if (bucket.timestamps.every((t) => t <= cutoff)) {
        store.delete(k);
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - recent.length),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimitStore(): void {
  store.clear();
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') || 'local';
}
