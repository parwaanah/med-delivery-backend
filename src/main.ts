// path: src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './utils/prisma.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as bodyParser from 'body-parser';

// Redis connection logs
import { checkRedisConnection, closeRedisConnection } from './utils/redis-logger';

async function bootstrap() {
  // -----------------------------------------------------------
  // ⏳ FIX 1 — REDIS RETRY (prevents ECONNREFUSED spam)
  // -----------------------------------------------------------
  process.env.REDIS_RETRY_DELAY = '500';
  process.env.REDIS_RETRY_ATTEMPTS = '10';

  const app = await NestFactory.create(AppModule, { cors: true });

  // Logging + Validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3001;
  const redisUrl = config.get<string>('REDIS_URL') || 'redis://redis:6379';

  console.log('🧠 Using Redis URL:', redisUrl);

  // SECURITY
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // -----------------------------------------------------------
  // ⛔ LOADTEST MODE? (DISABLE_RATELIMIT=1)
  // -----------------------------------------------------------
  if (process.env.DISABLE_RATELIMIT === '1') {
    console.log('⚡ LOADTEST MODE ENABLED — RateLimit DISABLED');
  } else {
    app.use(
      rateLimit({
        windowMs: 60_000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          statusCode: 429,
          message: 'Too many requests, please slow down.',
        },
      }),
    );
  }

  // CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Razorpay Webhook (RAW)
  app.use(
    '/payments/webhook',
    bodyParser.raw({
      type: '*/*',
      limit: '5mb',
    }),
  );

  // JSON parser for rest
  app.use(bodyParser.json());

  // -----------------------------------------------------------
  // Swagger
  // -----------------------------------------------------------
  const swaggerCfg = new DocumentBuilder()
    .setTitle('Medicine Delivery API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup('docs', app, document);

  // Prisma graceful shutdown
  const prisma = app.get(PrismaService);
  if (prisma?.enableShutdownHooks) await prisma.enableShutdownHooks(app);

  // -----------------------------------------------------------
  // Redis health check (with retry)
  // -----------------------------------------------------------
  await checkRedisConnection(redisUrl).catch((err) =>
    console.warn('⚠️ Redis check failed:', err?.message || err),
  );

  console.log('💓 System Health OK — Redis + Prisma connected');
  console.log('🔐 Security: Helmet active');

  // Start
  await app.listen(port);

  console.log(`🚀 Server: http://localhost:${port}`);
  console.log(`📘 Swagger: http://localhost:${port}/docs`);
  console.log(
    `🌐 Admin Dashboard: http://localhost:${port}/public/admin-dashboard.html`,
  );

  // Graceful shutdown
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
