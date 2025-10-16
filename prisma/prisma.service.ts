import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Prisma connected to database');
    } catch (err) {
      this.logger.error('❌ Prisma connection failed:', err);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('❎ Prisma disconnected');
  }

  /**
   * 💥 Graceful shutdown for Prisma v5+
   * Uses Node's process signals instead of deprecated $on('beforeExit')
   */
  enableShutdownHooks(app: any) {
    const shutdown = async (signal: string) => {
      this.logger.warn(`⚠️ Received ${signal}, closing app...`);
      await app.close();
      this.logger.log('🧹 Application closed gracefully.');
      await this.$disconnect();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl + C
    process.on('SIGTERM', () => shutdown('SIGTERM')); // System stop
  }
}
