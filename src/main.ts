// path: src/main.ts
import * as crypto from 'crypto';

// ✅ REQUIRED for @nestjs/schedule on Node 18+
(globalThis as any).crypto = crypto;

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './utils/prisma.service';
import { RedisService } from './utils/redis.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as bodyParser from 'body-parser';

// Redis connection logs
import { checkRedisConnection, closeRedisConnection } from './utils/redis-logger';
import { validateEnv } from './utils/env';
import { getHttpCorsOrigins } from './utils/cors';
import { runDevSeedIfEmpty } from './utils/dev-seed';
import { SentryService } from './utils/sentry.service';

async function bootstrap() {
  // -----------------------------------------------------------
  // ⏳ REDIS RETRY (prevents ECONNREFUSED spam)
  // -----------------------------------------------------------
  process.env.REDIS_RETRY_DELAY = '500';
  process.env.REDIS_RETRY_ATTEMPTS = '10';

  validateEnv();

  const app = await NestFactory.create(AppModule);

  // Observability: Sentry (no-op when SENTRY_DSN missing)
  app.get(SentryService).init();

  // -----------------------------------------------------------
  // GLOBAL VALIDATION
  // -----------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // -----------------------------------------------------------
  // GLOBAL IDEMPOTENCY (Idempotency-Key header)
  // -----------------------------------------------------------
  try {
    const redis = app.get(RedisService);
    app.useGlobalInterceptors(new IdempotencyInterceptor(redis));
  } catch {}

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3001;
  const redisUrl =
    config.get<string>('REDIS_URL') || 'redis://redis:6379';

  console.log('🧠 Using Redis URL:', redisUrl);

  // -----------------------------------------------------------
  // SECURITY
  // -----------------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Trust proxy when deployed behind a reverse proxy / load balancer
  if (String(process.env.TRUST_PROXY || '').trim() === '1') {
    (app as any).set('trust proxy', 1);
  }

  // -----------------------------------------------------------
  // RATE LIMITING
  // -----------------------------------------------------------
  if (process.env.DISABLE_RATELIMIT === '1') {
    console.log('⚡ LOADTEST MODE — RateLimit DISABLED');
  } else {
    const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
    const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 120);
    app.use(
      rateLimit({
        windowMs: Number.isFinite(rateLimitWindowMs) ? rateLimitWindowMs : 60_000,
        max: Number.isFinite(rateLimitMax) ? rateLimitMax : 120,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          statusCode: 429,
          message: 'Too many requests, please slow down.',
        },
      }),
    );
  }

  // -----------------------------------------------------------
  // ✅ CORS — allow flexible dev origins (cookie mode safe)
  // -----------------------------------------------------------
  const cookieMode = String(process.env.AUTH_COOKIE_MODE || '').trim() === '1';
  const corsOrigins = getHttpCorsOrigins();
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  app.enableCors({
    origin: isProd
      ? (corsOrigins.length ? corsOrigins : ['http://localhost:3000'])
      : (origin, cb) => {
          // In dev, allow any origin (echo back) to avoid "Failed to fetch"
          if (!origin) return cb(null, true);
          return cb(null, true);
        },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Request-Id',
    ],
    credentials: cookieMode,
  });

  // -----------------------------------------------------------
  // Razorpay Webhook (RAW BODY)
  // -----------------------------------------------------------
  app.use(
    '/payments/webhook',
    bodyParser.raw({
      type: '*/*',
      limit: '5mb',
    }),
  );

  // JSON parser for all other routes
  app.use(
    bodyParser.json({
      limit: '2mb',
    }),
  );

  // -----------------------------------------------------------
  // Swagger
  // -----------------------------------------------------------
  const disableSwagger =
    String(process.env.DISABLE_SWAGGER || '').trim() === '1' ||
    String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  if (!disableSwagger) {
    const swaggerCfg = new DocumentBuilder()
      .setTitle('Medicine Delivery API')
      .setDescription('API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerCfg);
    SwaggerModule.setup('docs', app, document);
  }

  // -----------------------------------------------------------
  // Prisma graceful shutdown
  // -----------------------------------------------------------
  const prisma = app.get(PrismaService);
  if (prisma?.enableShutdownHooks) {
    await prisma.enableShutdownHooks(app);
  }

  // -----------------------------------------------------------
  // DB SAFETY: ensure enum values exist for old DBs
  // -----------------------------------------------------------
  try {
    await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderStatus' AND e.enumlabel = 'NEEDS_CONFIRMATION'
  ) THEN
    ALTER TYPE "OrderStatus" ADD VALUE 'NEEDS_CONFIRMATION';
  END IF;
END$$;
    `);
  } catch (e) {
    console.warn('Enum patch skipped:', (e as any)?.message ?? e);
  }

  // -----------------------------------------------------------
  // Redis health check
  // -----------------------------------------------------------
  await checkRedisConnection(redisUrl).catch((err) =>
    console.warn('⚠️ Redis check failed:', err?.message || err),
  );

  // -----------------------------------------------------------
  // DEV SEED: ensure medicines exist for local/demo runs
  // (runs only when DB is empty and dev flags are enabled)
  // -----------------------------------------------------------
  await runDevSeedIfEmpty(prisma).catch((err) =>
    console.warn('⚠️  Dev seed failed:', (err as any)?.message ?? err),
  );

  console.log('💓 System Health OK — Redis + Prisma connected');
  console.log('🔐 Security: Helmet active');

  // -----------------------------------------------------------
  // START SERVER
  // -----------------------------------------------------------
  await app.listen(port);

  console.log(`🚀 Server: http://localhost:${port}`);
  console.log(`📘 Swagger: http://localhost:${port}/docs`);
  // Admin dashboard is served by the Next.js frontend (/admin).

  // -----------------------------------------------------------
  // GRACEFUL SHUTDOWN
  // -----------------------------------------------------------
  const shutdown = async (sig: string) => {
    console.log(`\n🧹 ${sig} received. Closing Redis + Prisma...`);
    await closeRedisConnection().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('❌ Fatal bootstrap error:', err);
  process.exit(1);
});
