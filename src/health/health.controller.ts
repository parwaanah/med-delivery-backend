import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { redisPing } from '../utils/redis-logger';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async getHealth() {
    const results: Record<string, any> = {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    /* ---------------- DATABASE ---------------- */
    try {
      await this.prisma.$queryRaw`SELECT 1;`;
      results.database = { status: 'up' };
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : JSON.stringify(err) || 'Unknown error';
      results.database = { status: 'down', error: msg };
    }

    /* ---------------- REDIS ---------------- */
    let redisUp = false;
    try {
      await redisPing();
      redisUp = true;
      results.redis = { status: 'up' };
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : JSON.stringify(err) || 'Unknown error';
      results.redis = { status: 'down', error: msg };
    }

    /* ---------------- QUEUE ---------------- */
    // Queues are Redis-backed; if Redis is up, queue is operational
    results.queue = {
      status: redisUp ? 'up' : 'down',
    };

    /* ---------------- MEMORY ---------------- */
    const mem = process.memoryUsage();
    results.memory = {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
    };

    /* ---------------- FINAL STATUS ---------------- */
    const anyDown = Object.values(results).some(
      (v) => v && v.status === 'down',
    );

    if (anyDown) {
      throw new HttpException(
        { status: 'error', details: results },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ok', details: results };
  }
}
