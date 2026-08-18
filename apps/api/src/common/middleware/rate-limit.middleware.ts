import type { NextFunction, Request, RequestHandler, Response } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** Phase 7: limite simple par IP, suffisante pour l'instance interne mono-process. */
export function createRateLimitMiddleware({ windowMs, max }: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (request: Request, response: Response, next: NextFunction) => {
    if (request.method === 'OPTIONS') {
      next();
      return;
    }

    const now = Date.now();
    const key = clientIp(request);
    const current = buckets.get(key);
    const bucket =
      current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    cleanupExpiredBuckets(buckets, now);

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    response.setHeader('X-RateLimit-Limit', String(max));
    response.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    response.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      response.setHeader('Retry-After', String(retryAfterSeconds));
      response.status(429).json({
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Trop de requetes, veuillez reessayer dans un instant',
        timestamp: new Date().toISOString(),
        path: request.originalUrl,
      });
      return;
    }

    next();
  };
}

function clientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || request.ip || 'unknown';
  }
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function cleanupExpiredBuckets(buckets: Map<string, Bucket>, now: number): void {
  if (buckets.size < 10_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
