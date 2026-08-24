import type { NextFunction, Request, Response } from 'express';
import {
  AJAX_HEADER_NAME,
  AJAX_HEADER_VALUE,
  createCsrfProtectionMiddleware,
} from './csrf-protection.middleware';

function run(method: string, origin?: string, requestedWith?: string) {
  const request = {
    method,
    path: '/api/v1/auth/refresh',
    headers: {
      ...(origin ? { origin } : {}),
      ...(requestedWith ? { [AJAX_HEADER_NAME]: requestedWith } : {}),
    },
  } as unknown as Request;
  const response = {
    append: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  createCsrfProtectionMiddleware({ allowedOrigins: ['https://visiora.example'] })(
    request,
    response,
    next,
  );
  return { response, next };
}

describe('csrfProtectionMiddleware', () => {
  it('laisse passer les lectures', () => {
    expect(run('GET').next).toHaveBeenCalled();
  });

  it('accepte une mutation du SPA avec le header attendu', () => {
    expect(run('POST', 'https://visiora.example', AJAX_HEADER_VALUE).next).toHaveBeenCalled();
  });

  it('refuse une origine non autorisée', () => {
    const { response, next } = run('POST', 'https://attacker.example', AJAX_HEADER_VALUE);
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it('refuse une mutation sans header personnalisé', () => {
    expect(run('POST', 'https://visiora.example').response.status).toHaveBeenCalledWith(403);
  });
});
