"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const prisma_service_1 = require("../prisma/prisma.service");
const nest_winston_1 = require("nest-winston");
const winston_config_1 = require("./common/logger/winston.config");
const http_exception_filter_1 = require("./shared/filters/http-exception.filter");
const request_context_1 = require("./common/context/request-context");
const crypto_1 = require("crypto");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: nest_winston_1.WinstonModule.createLogger(winston_config_1.winstonConfig),
    });
    app.use((req, res, next) => {
        request_context_1.RequestContext.run(next, {
            requestId: (0, crypto_1.randomUUID)(),
            userId: req.user?.id ?? '-',
            userRole: req.user?.role ?? '-',
        });
    });
    const winstonLogger = app.get(nest_winston_1.WINSTON_MODULE_NEST_PROVIDER);
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter(winstonLogger));
    app.use((0, helmet_1.default)());
    app.enableCors({
        origin: ['http://localhost:5173'],
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        credentials: true,
    });
    app.use((0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: 'Too many requests, please try again later.',
    }));
    const prismaService = app.get(prisma_service_1.PrismaService);
    await prismaService.enableShutdownHooks(app);
    await app.listen(3001);
    console.log('🚀 Backend running securely at http://localhost:3001');
}
bootstrap();
//# sourceMappingURL=main.js.map