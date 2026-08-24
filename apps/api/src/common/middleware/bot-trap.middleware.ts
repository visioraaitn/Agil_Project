import { Logger } from '@nestjs/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

const TRAP_PATHS = new Set([
  '/.env',
  '/.git/config',
  '/phpmyadmin',
  '/wp-admin',
  '/wp-login.php',
  '/xmlrpc.php',
]);
const LOG_COOLDOWN_MS = 15 * 60_000;
const MAX_TRACKED_CLIENTS = 10_000;

/**
 * Honeypot strictement défensif : détecte les scans automatisés de chemins qui
 * n'existent pas dans VisioraAI. Il ne contacte jamais la source et ne réalise
 * aucune « contre-attaque ».
 */
export function createBotTrapMiddleware(): RequestHandler {
  const logger = new Logger('BotTrap');
  const lastLoggedAt = new Map<string, number>();

  return (request: Request, response: Response, next: NextFunction) => {
    if (!TRAP_PATHS.has(request.path.toLowerCase())) {
      next();
      return;
    }

    const now = Date.now();
    const client = request.ip || request.socket.remoteAddress || 'unknown';
    const previous = lastLoggedAt.get(client) ?? 0;
    if (now - previous >= LOG_COOLDOWN_MS) {
      lastLoggedAt.set(client, now);
      logger.warn(
        `Scan automatisé détecté depuis ${client} (CF-Ray: ${request.headers['cf-ray'] ?? 'absent'})`,
      );
    }
    cleanup(lastLoggedAt, now);

    response.setHeader('Cache-Control', 'no-store');
    response.status(404).json({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: "La ressource demandée n'existe pas",
      timestamp: new Date().toISOString(),
      path: request.path,
    });
  };
}

function cleanup(entries: Map<string, number>, now: number): void {
  if (entries.size < MAX_TRACKED_CLIENTS) return;
  for (const [client, timestamp] of entries) {
    if (now - timestamp >= LOG_COOLDOWN_MS) entries.delete(client);
  }
  while (entries.size > MAX_TRACKED_CLIENTS) {
    const oldest = entries.keys().next().value as string | undefined;
    if (!oldest) break;
    entries.delete(oldest);
  }
}
