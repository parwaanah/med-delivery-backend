import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    // No $on('beforeExit') with library engine — instead use process hooks below.
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Call from main.ts after app is created. This ensures Prisma shuts down
   * when Nest app is terminated (SIGINT/SIGTERM).
   */
  async enableShutdownHooks(app: INestApplication) {
    const shutdown = async () => {
      try {
        await this.$disconnect();
      } catch (e) {
        // ignore
      } finally {
        // give app time to finish logs
        try { app.close(); } catch { /* ignore */ }
        process.exit(0);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('beforeExit', async () => {
      await this.$disconnect();
    });
  }
}
