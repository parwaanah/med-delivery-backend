import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, of, from } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import { RedisService } from '../../utils/redis.service';

type Stored = {
  statusCode: number;
  body: any;
  at: string;
};

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req: any = http.getRequest();
    const res: any = http.getResponse();

    const method = String(req.method || '').toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      return next.handle();
    }

    const key = req.header?.('Idempotency-Key') || req.headers?.['idempotency-key'];
    if (!key) return next.handle();

    const userId =
      req?.user?.id != null ? String(req.user.id) : req.ip ? String(req.ip) : 'anon';
    const routeKey = `idem:${userId}:${method}:${req.originalUrl}:${String(key)}`;
    const ttlSec = Number(process.env.IDEMPOTENCY_TTL_SEC || 24 * 60 * 60);

    return from(this.redis.client.get(routeKey)).pipe(
      mergeMap((hit) => {
        if (hit) {
          try {
            const parsed = JSON.parse(hit) as Stored;
            if (parsed?.statusCode) res.status(parsed.statusCode);
            return of(parsed.body);
          } catch {
            // corrupted cache: fall through
          }
        }

        return next.handle().pipe(
          tap({
            next: async (body) => {
              const stored: Stored = {
                statusCode: res?.statusCode ?? 200,
                body,
                at: new Date().toISOString(),
              };
              try {
                await this.redis.client.set(routeKey, JSON.stringify(stored), {
                  EX: Math.max(60, Math.floor(ttlSec)),
                });
              } catch {
                // best-effort
              }
            },
          }),
        );
      }),
    );
  }
}

