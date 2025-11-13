import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DbCountRow {
  count: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, 'ADMIN', 'admin')
@Controller('admin/metrics')
export class AdminMetricsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getMetrics() {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    const cpuLoad = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    // ✅ Redis Ping
    let redisPing: string;
    try {
      const { stdout } = await execAsync('redis-cli ping');
      redisPing = stdout.trim();
    } catch {
      redisPing = 'unreachable';
    }

    // ✅ DB connections
    let activeConnections = 0;
    try {
      const dbSessions = (await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database();`,
      )) as DbCountRow[];
      activeConnections = parseInt(dbSessions?.[0]?.count || '0', 10);
    } catch {
      activeConnections = 0;
    }

    // ✅ Entity counts (Overview tab)
    const [ordersCount, usersCount, pharmaciesCount, ridersCount] =
      await Promise.all([
        this.prisma.order.count(),
        this.prisma.user.count(),
        this.prisma.user.count({ where: { role: 'PHARMACY' } }),
        this.prisma.user.count({ where: { role: 'RIDER' } }),
      ]);

    return {
      orders: { total: ordersCount },
      users: { count: usersCount },
      pharmacies: { count: pharmaciesCount },
      riders: { count: ridersCount },
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        cpuLoad1m: cpuLoad[0].toFixed(2),
        totalMemMB: Math.round(totalMem / 1024 / 1024),
        usedMemMB: Math.round((totalMem - freeMem) / 1024 / 1024),
        uptimeMinutes: Math.round(uptime / 60),
      },
      redis: redisPing,
      database: { activeConnections },
      node: {
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
