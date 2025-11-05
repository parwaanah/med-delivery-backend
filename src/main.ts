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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const logger = new GlobalLogger();
  app.useLogger(logger);

  // ✅ Global validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ✅ Configs
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3001;
  const redisUrl = configService.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379';
  console.log('🧠 Using Redis URL:', redisUrl);

  // ✅ Serve static dashboard
  app.use('/public', express.static(join(__dirname, '..', 'public')));

  // ✅ Swagger configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Medicine Delivery API')
    .setDescription('API documentation for Medicine Delivery Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // ✅ Prisma shutdown hooks
  const prisma = app.get(PrismaService);
  if (prisma && typeof prisma.enableShutdownHooks === 'function') {
    await prisma.enableShutdownHooks(app);
  }

  // ✅ Redis check
  await checkRedisConnection(redisUrl).catch((e) => {
    console.warn('⚠️ Redis connect check failed:', e instanceof Error ? e.message : e);
  });

  // ✅ Start app
  await app.listen(port);
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`📘 Swagger docs available at http://localhost:${port}/docs`);
  console.log(`🌐 Live Audit Dashboard available at http://localhost:${port}/public/audit-dashboard.html`);

  // ✅ Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🧹 ${signal} received. Closing Redis + Prisma...`);
    await closeRedisConnection().catch(() => {});
    try {
      await prisma.$disconnect();
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.warn('⚠️ Error closing Prisma:', err.message);
      } else {
        console.warn('⚠️ Error closing Prisma (unknown):', err);
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

bootstrap().catch((err: unknown) => {
  if (err instanceof Error) {
    console.error('❌ Fatal bootstrap error:', err.message);
  } else {
    console.error('❌ Fatal bootstrap error (unknown):', err);
  }
  process.exit(1);
});
