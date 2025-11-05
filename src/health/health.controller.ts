import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { Redis } from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}
  private redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

  @Get()
  async check() {
    const db = await this.prisma.$queryRaw`SELECT 1`;
    const redisOk = await this.redis.ping();
    return {
      status: 'ok',
      db: !!db,
      redis: redisOk === 'PONG',
      timestamp: new Date().toISOString(),
    };
  }
}
