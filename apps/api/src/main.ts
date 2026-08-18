import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createRateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { requestLoggerMiddleware } from './common/middleware/request-logger.middleware';
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

  app.setGlobalPrefix(prefix);
  app.use(helmet());
  app.use(createRateLimitMiddleware({ windowMs: rateLimitWindowMs, max: rateLimitMax }));
  app.use(requestLoggerMiddleware());
  app.use(cookieParser());
  // credentials: le refresh token voyage dans un cookie httpOnly (phase 1).
  app.enableCors({ origin: corsOrigin.split(','), credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('VisioraAI Agile API')
      .setDescription('Plateforme de gestion de projets agile — API REST')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API démarrée sur http://localhost:${port}${prefix}`);
  if (nodeEnv !== 'production') {
    logger.log(`Documentation Swagger : http://localhost:${port}${prefix}/docs`);
  }
}

void bootstrap();
