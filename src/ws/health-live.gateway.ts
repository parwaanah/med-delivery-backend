import { WebSocketGateway, WebSocketServer, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { PrismaService } from '../utils/prisma.service';
import { redisPing } from '../utils/redis-logger';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({ cors: true, namespace: '/health-live' })
export class HealthLiveGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;
  private redisUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.redisUrl = this.config.get<string>('REDIS_URL') || 'redis://redis:6379';
  }

  afterInit() {
    console.log('⚡ HealthLiveGateway initialized');
    this.startBroadcastLoop();
  }

  private async startBroadcastLoop() {
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
    while (true) {
      try {
        const report = await this.checkSystemHealth();
        this.server.emit('health_update', report);
      } catch (err) {
        console.error('💀 Health broadcast failed:', err);
      }
      await delay(10_000);
    }
  }

  private async checkSystemHealth() {
    const results: Record<string, any> = {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    try {
      await this.prisma.$queryRaw`SELECT 1;`;
      results.database = { status: 'up' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err) || 'Unknown error';
      results.database = { status: 'down', error: msg };
    }

    try {
      await redisPing();
      results.redis = { status: 'up' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err) || 'Unknown error';
      results.redis = { status: 'down', error: msg };
    }

    const mem = process.memoryUsage();
    results.memory = {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
    };

    return results;
  }
}
