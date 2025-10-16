"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorLoggerMiddleware = void 0;
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const util_1 = __importDefault(require("util"));
const request_context_1 = require("../context/request-context");
let ErrorLoggerMiddleware = class ErrorLoggerMiddleware {
    winstonLogger;
    fallbackLogger = new common_1.Logger('ErrorLogger');
    constructor(winstonLogger) {
        this.winstonLogger = winstonLogger;
    }
    use(req, res, next) {
        const start = Date.now();
        res.on('finish', () => {
            if (res.statusCode < 400 ||
                req.originalUrl.includes('/health') ||
                res.statusCode === 404)
                return;
            const duration = Date.now() - start;
            const user = req.user || {};
            const requestId = request_context_1.RequestContext.getRequestId();
            const logEntry = {
                requestId,
                timestamp: new Date().toISOString(),
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: duration,
                ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
                userId: user.id ?? '-',
                userRole: user.role ?? '-',
                body: this.safeStringify(req.body),
                query: req.query,
                params: req.params,
            };
            const message = `[reqId:${requestId}] [HTTP] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms) user:${logEntry.userId} role:${logEntry.userRole}`;
            try {
                if (res.statusCode >= 500) {
                    this.winstonLogger
                        ? this.winstonLogger.error(message, logEntry)
                        : this.fallbackLogger.error(JSON.stringify(logEntry));
                }
                else {
                    this.winstonLogger
                        ? this.winstonLogger.warn(message, logEntry)
                        : this.fallbackLogger.warn(JSON.stringify(logEntry));
                }
            }
            catch (err) {
                this.fallbackLogger.error('❌ ErrorLoggerMiddleware crashed:', err.message);
            }
        });
        next();
    }
    safeStringify(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        }
        catch {
            return util_1.default.inspect(value, { depth: 2, colors: false });
        }
    }
};
exports.ErrorLoggerMiddleware = ErrorLoggerMiddleware;
exports.ErrorLoggerMiddleware = ErrorLoggerMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_NEST_PROVIDER)),
    __metadata("design:paramtypes", [winston_1.Logger])
], ErrorLoggerMiddleware);
//# sourceMappingURL=error-logger.middleware.js.map