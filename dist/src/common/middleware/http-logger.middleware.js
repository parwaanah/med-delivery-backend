"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpLoggerMiddleware = void 0;
const common_1 = require("@nestjs/common");
let HttpLoggerMiddleware = class HttpLoggerMiddleware {
    logger = new common_1.Logger('HTTP');
    use(req, res, next) {
        const startTime = Date.now();
        const { method, originalUrl } = req;
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const { statusCode } = res;
            const userId = req.user?.id || '-';
            const userRole = req.user?.role || '-';
            const message = {
                timestamp: new Date().toISOString(),
                method,
                url: originalUrl,
                statusCode,
                duration,
                ip,
                userId,
                userRole,
            };
            const logText = `${method} ${originalUrl} ${statusCode} [${duration}ms] user:${userId} role:${userRole} ip:${ip}`;
            if (statusCode >= 500)
                this.logger.error(logText, JSON.stringify(message));
            else if (statusCode >= 400)
                this.logger.warn(logText, JSON.stringify(message));
            else
                this.logger.log(logText, JSON.stringify(message));
        });
        next();
    }
};
exports.HttpLoggerMiddleware = HttpLoggerMiddleware;
exports.HttpLoggerMiddleware = HttpLoggerMiddleware = __decorate([
    (0, common_1.Injectable)()
], HttpLoggerMiddleware);
//# sourceMappingURL=http-logger.middleware.js.map