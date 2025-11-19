import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll() {
    try {
      return await this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
    } catch (err) {
      this.logger.error('Failed to fetch notifications', err);
      return [];
    }
  }
}
