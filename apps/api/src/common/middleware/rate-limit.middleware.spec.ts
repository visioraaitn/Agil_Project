import type { NextFunction, Request, Response } from 'express';
import { createRateLimitMiddleware } from './rate-limit.middleware';

function responseMock(): Response {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
}

describe('rateLimitMiddleware', () => {
  it("utilise request.ip et ignore un X-Forwarded-For fourni par l'attaquant", () => {
    const middleware = createRateLimitMiddleware({ windowMs: 60_000, max: 1 });
    const next = jest.fn() as NextFunction;
    const first = {
      method: 'GET',
      ip: '203.0.113.10',
      path: '/api/v1/projects',
      headers: { 'x-forwarded-for': '198.51.100.1' },
      socket: {},
    } as unknown as Request;
    const second = {
      ...first,
      headers: { 'x-forwarded-for': '198.51.100.2' },
    } as unknown as Request;
    const blockedResponse = responseMock();

    middleware(first, responseMock(), next);
    middleware(second, blockedResponse, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
  });
});
