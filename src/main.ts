import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaService } from '../prisma/prisma.service';
import { WinstonModule, WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { winstonConfig } from './common/logger/winston.config';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { RequestContext } from './common/context/request-context'; // ✅ Request ID context
import { randomUUID } from 'crypto';

async function bootstrap() {
  // 🧩 Initialize app with Winston logger
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  // 🧠 Attach Request ID Context for every request
  app.use((req, res, next) => {
    RequestContext.run(next, {
      requestId: randomUUID(),
      userId: (req as any).user?.id ?? '-',
      userRole: (req as any).user?.role ?? '-',
    });
  });

  // 🧾 Global Exception Filter (with Winston)
  const winstonLogger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useGlobalFilters(new HttpExceptionFilter(winstonLogger));

  // 🔒 Secure HTTP headers
  app.use(helmet());

  // 🌐 Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // 🚫 Express-level rate limiter
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit per IP
      message: 'Too many requests, please try again later.',
    }),
  );

  // ✅ Graceful Prisma shutdown
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  // 🚀 Start server
  await app.listen(3001);
  console.log('🚀 Backend running securely at http://localhost:3001');
}

bootstrap();
