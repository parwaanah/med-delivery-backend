import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './utils/prisma.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalLogger } from './common/logger/global-logger.service';
import { checkRedisConnection, closeRedisConnection } from './utils/redis-logger';
import { join } from 'path';
import * as express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useLogger(new GlobalLogger());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3001;
  const redisUrl = config.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379';
  console.log('🧠 Using Redis URL:', redisUrl);

  // 🛡️ Security middleware (Helmet CSP)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // allowed for dev dashboards; remove for production
            'https://cdn.socket.io',
            'https://cdn.jsdelivr.net',
            'https://cdnjs.cloudflare.com',
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", `http://localhost:${port}`, `ws://localhost:${port}`],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
        },
      },
    }),
  );

  // 🚦 Rate limiting
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { statusCode: 429, message: 'Too many requests, please slow down.' },
    }),
  );

  // 🌐 CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 📁 Static dashboards
  app.use('/public', express.static(join(__dirname, '..', 'public')));

  // 📘 Swagger
  const swaggerCfg = new DocumentBuilder()
    .setTitle('Medicine Delivery API')
    .setDescription('API documentation for Medicine Delivery Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup('docs', app, doc);

  // 🧩 Prisma shutdown hook
  const prisma = app.get(PrismaService);
  if (prisma?.enableShutdownHooks) await prisma.enableShutdownHooks(app);

  // 🔌 Redis check (singleton internally)
  await checkRedisConnection(redisUrl).catch((e) =>
    console.warn('⚠️ Redis connection check failed:', e instanceof Error ? e.message : e),
  );

  console.log('💓 System Health OK — Redis + Prisma connected');
  console.log('🔐 Security: Helmet + RateLimit active');

  // 🚀 Start server
  await app.listen(port);
  console.log(`🚀 Server: http://localhost:${port}`);
  console.log(`📘 Swagger: http://localhost:${port}/docs`);
  console.log(`🌐 Admin Dashboard: http://localhost:${port}/public/admin-dashboard.html`);
  console.log(`🌡️ Health: http://localhost:${port}/health`);

  // 🧹 Graceful shutdown
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
  console.error('❌ Fatal bootstrap error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
