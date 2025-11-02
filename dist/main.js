"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("./utils/prisma.service");
const swagger_1 = require("@nestjs/swagger");
const global_logger_service_1 = require("./common/logger/global-logger.service");
const redis_logger_1 = require("./utils/redis-logger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { cors: true });
    const logger = new global_logger_service_1.GlobalLogger();
    app.useLogger(logger);
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('PORT') || 3001;
    const redisUrl = configService.get('REDIS_URL') || 'redis://127.0.0.1:6379';
    console.log('🧠 Using Redis URL:', redisUrl);
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('Medicine Delivery API')
        .setDescription('API documentation for Medicine Delivery Platform')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('docs', app, document);
    const prisma = app.get(prisma_service_1.PrismaService);
    if (prisma && typeof prisma.enableShutdownHooks === 'function') {
        await prisma.enableShutdownHooks(app);
    }
    await (0, redis_logger_1.checkRedisConnection)(redisUrl).catch((e) => {
        console.warn('⚠️ Redis connect check failed:', e.message ?? e);
    });
    await app.listen(port);
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`📘 Swagger docs available at http://localhost:${port}/docs`);
    process.on('SIGINT', async () => {
        console.log('\n🧹 SIGINT received. Closing Redis + Prisma...');
        await (0, redis_logger_1.closeRedisConnection)().catch(() => { });
        try {
            await prisma.$disconnect();
        }
        catch { }
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.log('\n🧹 SIGTERM received. Closing Redis + Prisma...');
        await (0, redis_logger_1.closeRedisConnection)().catch(() => { });
        try {
            await prisma.$disconnect();
        }
        catch { }
        process.exit(0);
    });
}
bootstrap();
