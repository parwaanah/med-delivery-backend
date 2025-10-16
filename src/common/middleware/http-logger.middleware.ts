import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl } = req;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const userId = (req as any).user?.id || '-';
      const userRole = (req as any).user?.role || '-';

      // 🧠 Structured log message for Winston
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

      // 🎨 Console log (colorized automatically by Winston)
      const logText = `${method} ${originalUrl} ${statusCode} [${duration}ms] user:${userId} role:${userRole} ip:${ip}`;

      if (statusCode >= 500) this.logger.error(logText, JSON.stringify(message));
      else if (statusCode >= 400) this.logger.warn(logText, JSON.stringify(message));
      else this.logger.log(logText, JSON.stringify(message));
    });

    next();
  }
}
