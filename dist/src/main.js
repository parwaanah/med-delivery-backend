"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("./utils/prisma.service");
const swagger_1 = require("@nestjs/swagger");
const global_logger_service_1 = require("./common/logger/global-logger.service");
const redis_logger_1 = require("./utils/redis-logger");
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const bodyParser = __importStar(require("body-parser"));
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { cors: true });
    app.useLogger(new global_logger_service_1.GlobalLogger());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
    }));
    const config = app.get(config_1.ConfigService);
    const port = config.get('PORT') || 3001;
    const redisUrl = config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
    console.log('🧠 Using Redis URL:', redisUrl);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
    }));
    app.use((0, express_rate_limit_1.default)({
        windowMs: 60_000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            statusCode: 429,
            message: 'Too many requests, please slow down.',
        },
    }));
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });
    app.use('/payments/webhook', bodyParser.raw({
        type: '*/*',
        limit: '5mb',
    }));
    app.use(bodyParser.json());
    const swaggerCfg = new swagger_1.DocumentBuilder()
        .setTitle('Medicine Delivery API')
        .setDescription('API documentation')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerCfg);
    swagger_1.SwaggerModule.setup('docs', app, document);
    const prisma = app.get(prisma_service_1.PrismaService);
    if (prisma?.enableShutdownHooks)
        await prisma.enableShutdownHooks(app);
    await (0, redis_logger_1.checkRedisConnection)(redisUrl).catch((err) => console.warn('⚠️ Redis check failed:', err instanceof Error ? err.message : err));
    console.log('💓 System Health OK — Redis + Prisma connected');
    console.log('🔐 Security: Helmet + RateLimit active');
    await app.listen(port);
    console.log(`🚀 Server: http://localhost:${port}`);
    console.log(`📘 Swagger: http://localhost:${port}/docs`);
    console.log(`🌐 Admin Dashboard: http://localhost:${port}/public/admin-dashboard.html`);
    console.log(`🌡️ Health: http://localhost:${port}/health`);
    const shutdown = async (sig) => {
        console.log(`\n🧹 ${sig} received. Closing Redis + Prisma...`);
        await (0, redis_logger_1.closeRedisConnection)().catch(() => { });
        await prisma.$disconnect().catch(() => { });
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
bootstrap().catch((err) => {
    console.error('❌ Fatal bootstrap error:', err);
    process.exit(1);
});
