import type { NextFunction, Request, RequestHandler, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const AJAX_HEADER_NAME = 'x-requested-with';
export const AJAX_HEADER_VALUE = 'VisioraAI';

interface CsrfProtectionOptions {
  allowedOrigins: string[];
}

/**
 * Protection CSRF adaptée au SPA hébergé sur un domaine distinct de l'API.
 * Le header personnalisé force un preflight CORS, et Origin est comparé à une
 * liste exacte (aucun joker ni suffixe de sous-domaine).
 */
export function createCsrfProtectionMiddleware({
  allowedOrigins,
}: CsrfProtectionOptions): RequestHandler {
  const trustedOrigins = new Set(allowedOrigins.map(normalizeOrigin));

  return (request: Request, response: Response, next: NextFunction) => {
    response.append('Vary', 'Origin');
    response.append('Vary', 'Sec-Fetch-Site');
    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      next();
      return;
    }

    const origin = request.headers.origin;
    const requestedWith = request.headers[AJAX_HEADER_NAME];
    const originIsTrusted =
      typeof origin === 'string' && trustedOrigins.has(normalizeOrigin(origin));

    if ((origin && !originIsTrusted) || requestedWith !== AJAX_HEADER_VALUE) {
      response.status(403).json({
        statusCode: 403,
        code: 'CSRF_REJECTED',
        message: 'Origine ou en-tête de sécurité invalide',
        timestamp: new Date().toISOString(),
        path: request.path,
      });
      return;
    }

    next();
  };
}

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}
