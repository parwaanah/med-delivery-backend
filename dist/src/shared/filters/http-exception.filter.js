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
var HttpExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const request_context_1 = require("../../common/context/request-context");
const util_1 = __importDefault(require("util"));
let HttpExceptionFilter = HttpExceptionFilter_1 = class HttpExceptionFilter {
    winstonLogger;
    logger = new common_1.Logger(HttpExceptionFilter_1.name);
    constructor(winstonLogger) {
        this.winstonLogger = winstonLogger;
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const requestId = request_context_1.RequestContext.getRequestId();
        const user = request.user || {};
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let details = null;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            message = typeof res === 'string' ? res : res.message || message;
            details = typeof res === 'object' ? res : null;
        }
        else if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            status = common_1.HttpStatus.BAD_REQUEST;
            message = 'Database request error';
            details = { code: exception.code, meta: exception.meta };
        }
        else if (exception instanceof client_1.Prisma.PrismaClientValidationError) {
            status = common_1.HttpStatus.BAD_REQUEST;
            message = 'Invalid Prisma query';
        }
        else if (exception instanceof Error) {
            message = exception.message;
            details = exception.stack;
        }
        const safeDetails = this.safeStringify(details);
        const logPayload = {
            requestId,
            method: request.method,
            url: request.url,
            status,
            message,
            details: safeDetails,
            ip: request.ip || request.headers['x-forwarded-for'] || 'unknown',
            userId: user.id ?? '-',
            userRole: user.role ?? '-',
            timestamp: new Date().toISOString(),
        };
        const logMessage = `[reqId:${requestId}] ${request.method} ${request.url} → ${status} :: ${message}`;
        this.logger.error(logMessage);
        this.winstonLogger.error(logMessage, logPayload);
        response.status(status).json({
            success: false,
            statusCode: status,
            message,
            path: request.url,
            timestamp: new Date().toISOString(),
            requestId,
            ...(process.env.NODE_ENV === 'development' ? { details: safeDetails } : {}),
        });
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
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = HttpExceptionFilter_1 = __decorate([
    (0, common_1.Catch)(),
    __param(0, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_NEST_PROVIDER)),
    __metadata("design:paramtypes", [winston_1.Logger])
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map