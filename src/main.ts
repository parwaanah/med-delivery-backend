import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './utils/prisma.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalLogger } from './common/logger/global-logger.service';
import { checkRedisConnection, closeRedisConnection } from './utils/redis-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const logger = new GlobalLogger();
  app.useLogger(logger);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3001;
  const redisUrl = configService.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379';
  console.log('🧠 Using Redis URL:', redisUrl);

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Medicine Delivery API')
    .setDescription('API documentation for Medicine Delivery Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Prisma shutdown hooks
  const prisma = app.get(PrismaService);
  if (prisma && typeof prisma.enableShutdownHooks === 'function') {
    await prisma.enableShutdownHooks(app);
  }

  // Redis connect check (optional)
  await checkRedisConnection(redisUrl).catch((e) => {
    console.warn('⚠️ Redis connect check failed:', e.message ?? e);
  });

  await app.listen(port);
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`📘 Swagger docs available at http://localhost:${port}/docs`);

  process.on('SIGINT', async () => {
    console.log('\n🧹 SIGINT received. Closing Redis + Prisma...');
    await closeRedisConnection().catch(() => {});
    try { await prisma.$disconnect(); } catch {}
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🧹 SIGTERM received. Closing Redis + Prisma...');
    await closeRedisConnection().catch(() => {});
    try { await prisma.$disconnect(); } catch {}
    process.exit(0);
  });
}

bootstrap();
