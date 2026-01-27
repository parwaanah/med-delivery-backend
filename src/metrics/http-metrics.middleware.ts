import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal } from './http-metrics';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationNs = Number(process.hrtime.bigint() - start);
      const durationSec = durationNs / 1e9;
      const route =
        (req.baseUrl || '') +
        ((req as any).route?.path ? (req as any).route?.path : req.path);
      const labels = {
        method: req.method,
        route: route || req.path || 'unknown',
        status_code: String(res.statusCode),
      };

      httpRequestTotal.labels(labels.method, labels.route, labels.status_code).inc();
      httpRequestDuration
        .labels(labels.method, labels.route, labels.status_code)
        .observe(durationSec);
    });

    next();
  }
}
