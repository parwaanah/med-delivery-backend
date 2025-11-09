// src/webhooks/webhooks.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';

@Injectable()
export class WebhooksService {
  constructor(
    private prisma: PrismaService,
    private notify: NotificationService,
  ) {}

  async handlePharmacyCallback(key: string, payload: any) {
    if (key !== process.env.PHARMACY_WEBHOOK_KEY)
      throw new ForbiddenException('Invalid pharmacy key');

    const { orderId, status } = payload;
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
    await this.notify.sendAdminToast({
      type: 'info',
      title: 'Pharmacy Webhook',
      text: `Order #${orderId} → ${status}`,
    });
    return { ok: true };
  }

  async handleRiderCallback(key: string, payload: any) {
    if (key !== process.env.RIDER_WEBHOOK_KEY)
      throw new ForbiddenException('Invalid rider key');

    const { riderId, lat, lon } = payload;
    await this.prisma.user.update({
      where: { id: riderId },
      data: { latitude: lat, longitude: lon },
    });
    await this.notify.sendAdminToast({
      type: 'info',
      title: 'Rider Webhook',
      text: `Rider #${riderId} → (${lat}, ${lon})`,
    });
    return { ok: true };
  }
}
