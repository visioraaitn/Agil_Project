import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

interface LogPayload {
  level: 'info' | 'warn' | 'error';
  event: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestId: string;
  ip?: string;
  userAgent?: string;
}

export function requestLoggerMiddleware(): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    const startedAt = performance.now();
    const requestId = request.headers['x-request-id']?.toString() ?? randomUUID();
    response.setHeader('X-Request-Id', requestId);

    response.on('finish', () => {
      const statusCode = response.statusCode;
      const payload: LogPayload = {
        level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
        event: 'http_request',
        method: request.method,
        path: request.originalUrl,
        statusCode,
        durationMs: Math.round(performance.now() - startedAt),
        requestId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      };

      const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'visiora-api',
        ...payload,
      });

      if (payload.level === 'error') console.error(line);
      else if (payload.level === 'warn') console.warn(line);
      else console.info(line);
    });

    next();
  };
}
