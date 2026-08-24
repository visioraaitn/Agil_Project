import type { NextFunction, Request, Response } from 'express';
import { createBotTrapMiddleware } from './bot-trap.middleware';

function run(path: string) {
  const request = {
    path,
    ip: '203.0.113.10',
    headers: {},
    socket: {},
  } as unknown as Request;
  const response = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  createBotTrapMiddleware()(request, response, next);
  return { response, next };
}

describe('botTrapMiddleware', () => {
  it('laisse passer une route applicative', () => {
    expect(run('/api/v1/projects').next).toHaveBeenCalled();
  });

  it('masque les chemins ciblés par les scanners automatisés', () => {
    const { response, next } = run('/.env');
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(404);
  });
});
