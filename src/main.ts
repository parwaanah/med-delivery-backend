import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './utils/prisma.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalLogger } from './common/logger/global-logger.service';
import { checkRedisConnection, closeRedisConnection } from './utils/redis-logger';
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

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

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

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // ❌ REMOVE express.static — ServeStaticModule handles it
  // app.use('/public', express.static(...));

  // Swagger
  const swaggerCfg = new DocumentBuilder()
    .setTitle('Medicine Delivery API')
    .setDescription('API docs')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup('docs', app, document);

  // Prisma shutdown hook
  const prisma = app.get(PrismaService);
  if (prisma?.enableShutdownHooks) await prisma.enableShutdownHooks(app);

  await checkRedisConnection(redisUrl).catch((err) =>
    console.warn('⚠️ Redis check failed:', err instanceof Error ? err.message : err),
  );

  console.log('💓 System Health OK — Redis + Prisma connected');
  console.log('🔐 Security: Helmet + RateLimit active');

  await app.listen(port);

  console.log(`🚀 Server: http://localhost:${port}`);
  console.log(`📘 Swagger: http://localhost:${port}/docs`);
  console.log(`🌐 Admin Dashboard: http://localhost:${port}/public/admin-dashboard.html`);
  console.log(`🌡️ Health: http://localhost:${port}/health`);

  // Shutdown handling
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
