import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createRateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { createCsrfProtectionMiddleware } from './common/middleware/csrf-protection.middleware';
import { requestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { createBotTrapMiddleware } from './common/middleware/bot-trap.middleware';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Env, true>);

  const port = config.get('API_PORT', { infer: true });
  const prefix = config.get('API_PREFIX', { infer: true });
  const corsOrigin = config.get('CORS_ORIGIN', { infer: true });
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const rateLimitWindowMs = config.get('RATE_LIMIT_WINDOW_MS', { infer: true });
  const rateLimitMax = config.get('RATE_LIMIT_MAX', { infer: true });
  const loginRateLimitWindowMs = config.get('LOGIN_RATE_LIMIT_WINDOW_MS', { infer: true });
  const loginRateLimitMax = config.get('LOGIN_RATE_LIMIT_MAX', { infer: true });
  const refreshRateLimitWindowMs = config.get('REFRESH_RATE_LIMIT_WINDOW_MS', { infer: true });
  const refreshRateLimitMax = config.get('REFRESH_RATE_LIMIT_MAX', { infer: true });
  const allowedOrigins = corsOrigin.split(',').map((origin) => origin.trim());
  const csrfAllowedOrigins =
    nodeEnv === 'production'
      ? allowedOrigins
      : [...allowedOrigins, `http://localhost:${port}`, `http://127.0.0.1:${port}`];

  const express = app.getHttpAdapter().getInstance();
  // L'API Render n'est joignable qu'à travers son proxy. Un seul saut de
  // confiance permet à Express de calculer request.ip sans accepter une chaîne
  // X-Forwarded-For arbitraire fournie directement par le client.
  express.set('trust proxy', 1);
  express.disable('x-powered-by');

  app.setGlobalPrefix(prefix);
  app.use(helmet());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    // Les donnees de l'API sont privees : pas d'indexation ni de cache navigateur/intermediaire.
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'X-Request-Id'],
    maxAge: 86_400,
  });
  app.use(cookieParser());
  app.use(createCsrfProtectionMiddleware({ allowedOrigins: csrfAllowedOrigins }));
  app.use(
    `${prefix}/auth/login`,
    createRateLimitMiddleware({ windowMs: loginRateLimitWindowMs, max: loginRateLimitMax }),
  );
  app.use(
    `${prefix}/auth/refresh`,
    createRateLimitMiddleware({ windowMs: refreshRateLimitWindowMs, max: refreshRateLimitMax }),
  );
  app.use(createRateLimitMiddleware({ windowMs: rateLimitWindowMs, max: rateLimitMax }));
  app.use(createBotTrapMiddleware());
  app.use(requestLoggerMiddleware());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('visioPlanner API')
      .setDescription('Plateforme de gestion de projets agile — API REST')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swaggerConfig), {
      swaggerOptions: {
        requestInterceptor: (request: { headers: Record<string, string> }) => {
          request.headers['X-Requested-With'] = 'VisioraAI';
          return request;
        },
      },
    });
  }

  const server = await app.listen(port, '0.0.0.0');
  server.requestTimeout = 120_000;
  server.headersTimeout = 65_000;
  server.keepAliveTimeout = 60_000;
  server.maxRequestsPerSocket = 1_000;
  server.maxHeadersCount = 100;

  const logger = new Logger('Bootstrap');
  logger.log(`API démarrée sur http://localhost:${port}${prefix}`);
  if (nodeEnv !== 'production') {
    logger.log(`Documentation Swagger : http://localhost:${port}${prefix}/docs`);
  }
}

void bootstrap();
