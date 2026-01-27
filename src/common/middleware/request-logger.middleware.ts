import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { GlobalLogger } from '../logger/global-logger.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: GlobalLogger) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const incomingId = req.headers['x-request-id'];
    const requestId =
      typeof incomingId === 'string' && incomingId.trim()
        ? incomingId.trim()
        : randomUUID();
    (req as any).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const duration = Date.now() - start;
      const user = (req as any).user?.email || 'anonymous';
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const route =
        (req.baseUrl || '') +
        ((req as any).route?.path ? (req as any).route?.path : req.path);

      this.logger.log(
        {
          event: 'request',
          method: req.method,
          path: req.originalUrl,
          route: route || req.path,
          statusCode: res.statusCode,
          durationMs: duration,
          user,
          ip,
          requestId,
        },
        'Request',
      );
    });

    next();
  }
}
