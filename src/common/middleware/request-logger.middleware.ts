import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { GlobalLogger } from '../logger/global-logger.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: GlobalLogger) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const user = (req as any).user?.email || 'anonymous';
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      this.logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms) user=${user} ip=${ip}`,
        'Request',
      );
    });

    next();
  }
}
