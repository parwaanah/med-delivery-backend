import {
  Injectable,
  NestMiddleware,
  Inject,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import util from 'util';
import { RequestContext } from '../context/request-context'; // ✅ Request ID tracker

@Injectable()
export class ErrorLoggerMiddleware implements NestMiddleware {
  private readonly fallbackLogger = new Logger('ErrorLogger');

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly winstonLogger: WinstonLogger,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      // 🚫 Skip successful, health, and 404 requests (optional)
      if (
        res.statusCode < 400 ||
        req.originalUrl.includes('/health') ||
        res.statusCode === 404
      )
        return;

      const duration = Date.now() - start;
      const user = (req as any).user || {}; // comes from JWT guard
      const requestId = RequestContext.getRequestId(); // ✅ request correlation ID

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
        // 💥 Server-side error
        if (res.statusCode >= 500) {
          this.winstonLogger
            ? this.winstonLogger.error(message, logEntry)
            : this.fallbackLogger.error(JSON.stringify(logEntry));
        }
        // ⚠️ Client-side error
        else {
          this.winstonLogger
            ? this.winstonLogger.warn(message, logEntry)
            : this.fallbackLogger.warn(JSON.stringify(logEntry));
        }
      } catch (err) {
        this.fallbackLogger.error(
          '❌ ErrorLoggerMiddleware crashed:',
          (err as Error).message,
        );
      }
    });

    next();
  }

  // 🧠 Safe stringify without circular crash
  private safeStringify(value: any) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return util.inspect(value, { depth: 2, colors: false });
    }
  }
}
