// src/orders/orders.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { AnalyticsService } from '../utils/analytics.service';

import { CreateOrderDto } from './dto/create-order.dto';
import { OrderItemDto } from './dto/order-item.dto';

import { Queue } from 'bullmq';
import { WsGateway } from '../ws/ws.gateway';
import { ConfigService } from '@nestjs/config';
import { SurgeService } from '../surge/surge.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { PaymentsService } from '../payments/payments.service';
import { PharmacyAcceptDto } from './dto/pharmacy-accept.dto';
import { RiderPaymentsService } from '../riders/rider-payments.service';
import { RiderQualityService } from '../riders/rider-quality.service';
import { OrderLifecycleService } from './order-lifecycle.service';

import {
  OrderStatus,
  PaymentMode,
  UserRole,
} from '@prisma/client';
import { ServiceAreaService } from '../service-area/service-area.service';
import { badRequest } from '../common/api-error';

// Backwards-compatible with older generated Prisma clients (before enum update).
const NEEDS_CONFIRMATION_STATUS = 'NEEDS_CONFIRMATION' as unknown as OrderStatus;
const PRESCRIPTION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
const COUPON_TYPE = {
  PERCENT: 'PERCENT',
  FLAT: 'FLAT',
} as const;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly defaultRiderSearchKm: number;
  private readonly riderSpeedKmPerHr = 30;
  private readonly isLoadtest: boolean;

  constructor(
    private prisma: PrismaService,
    private notify: NotificationService,
    private analytics: AnalyticsService,
    private ws: WsGateway,
    private config: ConfigService,
    private surge: SurgeService,
    private geoSurge: GeoSurgeService,
    private payments: PaymentsService,
    private readonly riderPayments: RiderPaymentsService,
    private readonly riderQuality: RiderQualityService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly serviceArea: ServiceAreaService,
    @Inject('ORDER_ASSIGN_QUEUE') private orderAssignQueue: Queue,
  ) {
    this.defaultRiderSearchKm = Number(this.config.get('RIDER_SEARCH_KM') || 5);
    this.isLoadtest =
      String(
        process.env.LOADTEST_MODE || this.config.get('LOADTEST_MODE') || '',
      )
        .trim()
        .toLowerCase() === 'true';

    if (this.isLoadtest)
      this.logger.warn(
        'LOADTEST_MODE ACTIVE → inventory bypass + payment bypass enabled.',
      );
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------
  private isEscalatable(status: OrderStatus) {
    return (
      status === OrderStatus.PENDING ||
      status === OrderStatus.ACCEPTED ||
      status === OrderStatus.ASSIGNED
    );
  }

  private toRad(v: number) {
    return (v * Math.PI) / 180;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async logTimeline(orderId: number, event: string, data?: any) {
    try {
      await this.prisma.orderTimeline.create({
        data: {
          orderId,
          event,
          data: data ? JSON.stringify(data) : undefined,
        },
      });
    } catch (e) {
      this.logger.warn('Timeline failed', (e as any)?.message ?? e);
    }
  }

  private async requestCustomerPayment(order: {
    id: number;
    customerId: number;
    pharmacyId: number;
    status: any;
    paymentMode: any;
    paymentStatus?: any;
    requiresPrescription?: boolean;
    prescriptionId?: number | null;
  }) {
    const current = String((order as any).paymentStatus || 'UNPAID').toUpperCase();
    if (current === 'PAID' || current === 'REQUESTED') return { requested: false };

    // Only request payment after pharmacy acceptance (and confirmation resolved).
    const st = String(order.status || '').toUpperCase();
    if (st !== String(OrderStatus.ACCEPTED)) return { requested: false };

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'REQUESTED', paymentRequestedAt: new Date() } as any,
      select: { id: true, customerId: true, pharmacyId: true },
    });

    await this.logTimeline(order.id, 'PAYMENT_REQUESTED', {
      orderId: order.id,
      paymentMode: order.paymentMode,
    });

    await this.notify.createDomainEvent(
      updated.customerId,
      'payment.requested',
      `Payment requested for order #${order.id}`,
      { orderId: order.id },
      updated.pharmacyId,
    );

    this.analytics.track({
      name: 'payment_requested',
      userId: updated.customerId,
      props: { orderId: order.id, paymentMode: order.paymentMode },
    });

    return { requested: true };
  }

  // ----------------------------------------------------------
  // Payment mode resolver
  // ----------------------------------------------------------
  private defaultPaymentMode(): PaymentMode {
    const raw = String(
      process.env.DEFAULT_PAYMENT_MODE || this.config.get('DEFAULT_PAYMENT_MODE') || '',
    )
      .trim()
      .toUpperCase();

    if (raw === String(PaymentMode.PAY_FIRST)) return PaymentMode.PAY_FIRST;
    if (raw === String(PaymentMode.PAY_AFTER_VERIFICATION))
      return PaymentMode.PAY_AFTER_VERIFICATION;
    return PaymentMode.PAY_AFTER_ACCEPT;
  }

  private async resolveDeliverySnapshot(customerId: number, dto: any) {
    const addressIdRaw = dto?.addressId != null ? Number(dto.addressId) : null;

    let addr: any = null;
    if (addressIdRaw != null && Number.isFinite(addressIdRaw)) {
      addr = await (this.prisma as any).userAddress.findFirst({
        where: { id: addressIdRaw, userId: customerId },
      });
    }

    if (!addr) {
      addr = await (this.prisma as any).userAddress.findFirst({
        where: { userId: customerId, isDefault: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    const notes = String(dto?.deliveryNotes || '').trim();
    if (!addr) {
      const legacy = String(dto?.address || '').trim();
      return {
        deliveryAddressText: legacy || null,
        deliveryNotes: notes || '',
      };
    }

    return {
      deliveryAddressText: null,
      deliveryName: String(addr.name || '').trim() || null,
      deliveryPhone: String(addr.phone || '').trim() || null,
      deliveryLine1: String(addr.line1 || '').trim() || null,
      deliveryLine2: String(addr.line2 || '').trim() || '',
      deliveryCity: String(addr.city || '').trim() || null,
      deliveryState: String(addr.state || '').trim() || '',
      deliveryPin: String(addr.pin || '').trim() || null,
      deliveryLandmark: String(addr.landmark || '').trim() || '',
      deliveryNotes: notes || '',
    };
  }

  private resolveModeFromItems(items: OrderItemDto[]) {
    let requiresPrescription = false;
    let hasStrict = false;
    let hasChronic = false;
    let hasNonRx = false;

    for (const it of items) {
      const cat = (it as any).category;
      if (!cat) {
        hasChronic = true;
        continue;
      }

      const c = String(cat).toUpperCase();
      if (c === 'STRICT_RX' || c === 'STRICT' || c === 'HARD') {
        hasStrict = true;
        requiresPrescription = true;
      } else if (c === 'CHRONIC' || c === 'SOFT') {
        hasChronic = true;
      } else {
        hasNonRx = true;
      }
    }

    if (hasStrict)
      return {
        mode: PaymentMode.PAY_AFTER_VERIFICATION,
        requiresPrescription: true,
      };
    if (hasChronic && !hasNonRx)
      return { mode: PaymentMode.PAY_AFTER_ACCEPT, requiresPrescription: false };
    // Minimal customer flow: avoid requiring a payment gateway at order creation time.
    // We always use pay-after-accept in development; payment is requested only after pharmacy accepts.
    if (hasNonRx && !hasChronic)
      return { mode: PaymentMode.PAY_AFTER_ACCEPT, requiresPrescription: false };

    return { mode: PaymentMode.PAY_AFTER_ACCEPT, requiresPrescription: false };
  }

  // ----------------------------------------------------------
  // LOADTEST: stable pharmacy fetcher (never returns null)
  // ----------------------------------------------------------
  private async getAnyPharmacyId() {
    const p = await this.prisma.user.findFirst({
      where: { role: UserRole.PHARMACY },
      select: { id: true },
    });

    // fallback: always return 1 to avoid FK crash
    return p?.id ?? 1;
  }

  private consentRequired() {
    return (
      String(this.config.get('CONSENT_REQUIRED') ?? process.env.CONSENT_REQUIRED ?? '')
        .trim()
        .toLowerCase() === 'true'
    );
  }

  private currentTermsVersion() {
    return (
      String(this.config.get('TERMS_VERSION') ?? process.env.TERMS_VERSION ?? 'v1').trim() ||
      'v1'
    );
  }

  private async assertTermsAccepted(customerId: number) {
    if (!this.consentRequired()) return;
    const version = this.currentTermsVersion();

    const accepted = await (this.prisma as any).termsAcceptance.findUnique({
      where: { userId_version: { userId: customerId, version } },
      select: { acceptedAt: true },
    });

    if (!accepted) {
      badRequest('TERMS_REQUIRED', 'Terms acceptance required', { version });
    }
  }

  private couponsEnabled() {
    const raw = String(this.config.get('COUPONS_ENABLED') ?? process.env.COUPONS_ENABLED ?? '')
      .trim()
      .toLowerCase();
    if (!raw) return true;
    return raw === 'true';
  }

  private async resolveCouponForSubtotal(customerId: number, couponCode: string | null, subtotal: number) {
    if (!this.couponsEnabled()) return null;
    const code = String(couponCode || '').trim().toUpperCase();
    if (!code) return null;

    const now = new Date();
    const coupon = await (this.prisma as any).coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.active) badRequest('COUPON_INVALID', 'Invalid coupon');
    if (coupon.startsAt && coupon.startsAt > now) {
      badRequest('COUPON_NOT_STARTED', 'Coupon not started', { startsAt: coupon.startsAt });
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      badRequest('COUPON_EXPIRED', 'Coupon expired', { endsAt: coupon.endsAt });
    }

    const min = coupon.minOrder != null ? Number(coupon.minOrder) : null;
    if (min != null && subtotal < min) {
      badRequest('COUPON_MIN_ORDER', 'Order total too low for this coupon', { minOrder: min, subtotal });
    }

    const [totalUsed, userUsed] = await Promise.all([
      coupon.usageLimit != null
        ? (this.prisma as any).couponRedemption.count({
            where: { couponId: coupon.id, orderId: { not: null } },
          })
        : Promise.resolve(0),
      coupon.perUserLimit != null
        ? (this.prisma as any).couponRedemption.count({
            where: { couponId: coupon.id, userId: customerId, orderId: { not: null } },
          })
        : Promise.resolve(0),
    ]);

    if (coupon.usageLimit != null && totalUsed >= coupon.usageLimit) {
      badRequest('COUPON_USAGE_LIMIT', 'Coupon usage limit reached', {
        usageLimit: coupon.usageLimit,
        totalUsed,
      });
    }
    if (coupon.perUserLimit != null && userUsed >= coupon.perUserLimit) {
      badRequest('COUPON_PER_USER_LIMIT', 'Coupon already used', {
        perUserLimit: coupon.perUserLimit,
        userUsed,
      });
    }

    let discount = 0;
    if (String(coupon.type).toUpperCase() === COUPON_TYPE.FLAT) {
      discount = Number(coupon.amount);
    } else {
      const pct = Math.max(0, Math.min(100, Number(coupon.amount)));
      discount = (subtotal * pct) / 100;
    }

    const max = coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null;
    if (max != null) discount = Math.min(discount, max);

    discount = Math.max(0, Math.min(discount, subtotal));

    return { couponId: coupon.id as number, code, discount };
  }

  private async recordCouponRedemption(tx: any, couponId: number, customerId: number, orderId: number) {
    try {
      await tx.couponRedemption.create({
        data: { couponId, userId: customerId, orderId },
      });
    } catch (e) {
      this.logger.debug('Coupon redemption create skipped', (e as any)?.message ?? e);
    }
  }
    // ----------------------------------------------------------
  // CREATE ORDER — FULL METHOD
  // ----------------------------------------------------------
  async createOrder(customerId: number, dto: CreateOrderDto) {
    if (!customerId)
  throw new BadRequestException('Invalid customer');
    if (!dto.items?.length)
      throw new BadRequestException('No items provided');

    await this.assertTermsAccepted(customerId);

    const requestedCouponCode = String((dto as any)?.couponCode || '')
      .trim()
      .toUpperCase();

    const medicineIds = dto.items
      .map((i) => i.medicineId)
      .filter((v) => typeof v === 'number') as number[];

    if (!medicineIds.length)
      throw new BadRequestException('Invalid items');

    const resolved = this.resolveModeFromItems(dto.items);
    let mode: PaymentMode = resolved.mode as PaymentMode;
    let requiresPrescription = resolved.requiresPrescription;

    // Enforce prescription requirement based on Medicine.rxType
    const meds = await this.prisma.medicine.findMany({
      where: { id: { in: medicineIds } },
      select: { id: true, rxType: true },
    });
    const anyRx = meds.some(
      (m) => String(m.rxType).toUpperCase() !== 'NONE',
    );
    requiresPrescription = requiresPrescription || anyRx;
    if (requiresPrescription) {
      mode = PaymentMode.PAY_AFTER_VERIFICATION;
    }

    // Allow client to request a payment mode; keep a safe default for dev.
    const requested = (dto as any).paymentMode;
    if (!requiresPrescription && requested && Object.values(PaymentMode).includes(requested)) {
      mode = requested;
    } else if (!requiresPrescription && !requested) {
      mode = this.defaultPaymentMode();
    }

    const delivery = await this.resolveDeliverySnapshot(customerId, dto as any);

    const initialPaymentStatus =
      mode === PaymentMode.PAY_FIRST ? 'REQUESTED' : 'UNPAID';
    const initialPaymentRequestedAt =
      mode === PaymentMode.PAY_FIRST ? new Date() : null;

    // Geo tracking (best-effort)
    const orderGeoId = `order:${Date.now()}:${Math.random()
      .toString()
      .slice(2)}`;
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
    });
    const pickupLat = user?.latitude != null ? Number(user.latitude) : null;
    const pickupLon = user?.longitude != null ? Number(user.longitude) : null;

    // Enforce service area using customer location (precision: point-in-polygon zones).
    await this.serviceArea.assertPointServiced(pickupLat, pickupLon);

    if (pickupLat != null && pickupLon != null) {
      try {
        await this.geoSurge.addPoint(orderGeoId, pickupLon, pickupLat);
      } catch {}
    }

    // ----------------------------------------------------------
    // CASE 1: Direct pharmacy selected
    // ----------------------------------------------------------
    if ((dto as any).pharmacyId) {
      // LOADTEST MODE bypass inventory completely
      if (this.isLoadtest) {
        const chosen =
          Number((dto as any).pharmacyId) || (await this.getAnyPharmacyId());

        // FINAL safety: ensure pharmacyId always exists
        const validPharmacy = await this.prisma.user.findUnique({
          where: { id: chosen },
          select: { id: true },
        });
        const pharmacyId = validPharmacy?.id ?? (await this.getAnyPharmacyId());

        let total = 0;
        const itemsCreate = dto.items.map((it) => {
          const price = (it as any).price ? Number((it as any).price) : 10;
          total += price * (it.quantity ?? 1);

          return {
            medicineId: it.medicineId ?? 0,
            name:
              it.name ??
              `LT_Item_${it.medicineId ?? Math.random().toString(36)}`,
            quantity: it.quantity ?? 1,
            price,
          };
        });

        const coupon = await this.resolveCouponForSubtotal(
          customerId,
          requestedCouponCode || null,
          total,
        );
        const couponDiscount = coupon?.discount ?? 0;
        const finalTotal = Math.max(0, total - couponDiscount);

        const created = await this.prisma.order.create({
          data: {
            customerId,
            pharmacyId,
            totalPrice: finalTotal,
            couponCode: coupon?.code ?? null,
            couponDiscount,
            status: OrderStatus.PENDING,
            paymentMode: mode,
            paymentStatus: initialPaymentStatus,
            paymentRequestedAt: initialPaymentRequestedAt,
            requiresPrescription,
            ...(delivery as any),
            items: { create: itemsCreate },
          },
          include: { items: true },
        });

        if (coupon) {
          await this.recordCouponRedemption(this.prisma, coupon.couponId, customerId, created.id);
        }

        await this.prisma.orderOffer.create({
          data: {
            orderId: created.id,
            pharmacyId,
            offeredTo: 'PHARMACY',
          },
        });

        await this.logTimeline(created.id, 'ORDER_CREATED', {
          loadtest: true,
          mode,
          requiresPrescription,
        });

        this.analytics.track({
          name: 'order_created',
          userId: customerId,
          props: {
            orderId: created.id,
            paymentMode: mode,
            requiresPrescription,
            totalPrice: finalTotal,
            loadtest: true,
          },
        });

        if (mode === PaymentMode.PAY_FIRST) {
          await this.logTimeline(created.id, 'PAYMENT_REQUESTED', {
            orderId: created.id,
            paymentMode: mode,
            at: initialPaymentRequestedAt,
          });
        }

        this.notify.create(
          customerId,
          'ORDER_CREATED',
          `Order #${created.id} created`,
          { orderId: created.id, status: created.status },
        );

        this.notify.create(
          pharmacyId,
          'ORDER_PLACED',
          `Order #${created.id}`,
          { orderId: created.id },
          customerId,
        );
        this.ws.notifyUser(pharmacyId, 'order_placed', created);
        this.ws.notifyUser(pharmacyId, 'order.created', { order: created });

        // PAY_FIRST is disabled in minimal dev flow (handled as PAY_AFTER_ACCEPT).

        const delay =
          Number(this.config.get('ESCALATION_MINUTES') || 1) *
          60 *
          1000;

        await this.orderAssignQueue.add(
          'rider_escalation',
          { orderId: created.id },
          { delay },
        );

        try {
          await this.geoSurge.removePoint(orderGeoId);
        } catch {}

        return created;
      }

      // NORMAL MODE: validate inventory
      const pharmacyId = Number((dto as any).pharmacyId);

      const inv = await this.prisma.pharmacyInventory.findMany({
        where: ({ pharmacyId, medicineId: { in: medicineIds }, deletedAt: null } as any),
      });

      if (inv.length !== medicineIds.length)
        throw new NotFoundException('Some items not available at pharmacy');

      const order = await this.prisma.$transaction(async (tx) => {
        let total = 0;
        const itemsCreate = [];

        for (const it of dto.items) {
          const row = inv.find((r) => r.medicineId === it.medicineId);
          if (!row)
            throw new BadRequestException('Item not stocked');
          if (row.stock < it.quantity)
            throw new BadRequestException(
              `Insufficient stock for ${it.medicineId}`,
            );

          const price = Number(row.sellingPrice);
          total += price * it.quantity;

          const med = await tx.medicine.findUnique({
            where: { id: it.medicineId },
          });
          itemsCreate.push({
            medicineId: it.medicineId,
            name: med?.name ?? it.name ?? 'Item',
            quantity: it.quantity,
            price,
          });
        }

        const coupon = await this.resolveCouponForSubtotal(
          customerId,
          requestedCouponCode || null,
          total,
        );
        const couponDiscount = coupon?.discount ?? 0;
        const finalTotal = Math.max(0, total - couponDiscount);

        const created = await tx.order.create(({
          data: {
            customerId,
            pharmacyId,
            totalPrice: finalTotal,
            couponCode: coupon?.code ?? null,
            couponDiscount,
            status: OrderStatus.PENDING,
            paymentMode: mode,
            paymentStatus: initialPaymentStatus,
            paymentRequestedAt: initialPaymentRequestedAt,
            requiresPrescription,
            ...(delivery as any),
            items: { create: itemsCreate },
          },
          include: { items: true },
        } as any));

        if (coupon) {
          await this.recordCouponRedemption(tx, coupon.couponId, customerId, created.id);
        }

        // Stock is validated now, but decremented on pharmacy acceptance / fulfillment.

        await tx.orderOffer.create({
          data: {
            orderId: created.id,
            pharmacyId,
            offeredTo: 'PHARMACY',
          },
        });

        return created;
      });

      await this.logTimeline(order.id, 'ORDER_CREATED', {
        mode,
        requiresPrescription,
      });

      this.analytics.track({
        name: 'order_created',
        userId: customerId,
        props: {
          orderId: order.id,
          paymentMode: mode,
          requiresPrescription,
          totalPrice: (order as any)?.totalPrice ?? null,
        },
      });

      if (mode === PaymentMode.PAY_FIRST) {
        await this.logTimeline(order.id, 'PAYMENT_REQUESTED', {
          orderId: order.id,
          paymentMode: mode,
          at: initialPaymentRequestedAt,
        });
      }

      this.notify.create(
        customerId,
        'ORDER_CREATED',
        `Order #${order.id} created`,
        { orderId: order.id, status: order.status },
      );

      this.notify.create(
        order.pharmacyId,
        'ORDER_PLACED',
        `Order #${order.id}`,
        { orderId: order.id },
        customerId,
      );
      this.ws.notifyUser(order.pharmacyId, 'order_placed', order);
      this.ws.notifyUser(order.pharmacyId, 'order.created', { order });

      // PAY_FIRST is disabled in minimal dev flow (handled as PAY_AFTER_ACCEPT).

      const delay =
        Number(this.config.get('ESCALATION_MINUTES') || 1) *
        60 *
        1000;

      await this.orderAssignQueue.add(
        'rider_escalation',
        { orderId: order.id },
        { delay },
      );

      try {
        await this.geoSurge.removePoint(orderGeoId);
      } catch {}

      return order;
    }
        // ----------------------------------------------------------
    // CASE 2: AUTO-ROUTING
    // ----------------------------------------------------------

    // LOADTEST → bypass inventory routing
    if (this.isLoadtest) {
      const best =
        (await this.getAnyPharmacyId()) ??
        Number(this.config.get('LOADTEST_PHARMACY_ID'));

      if (!best) throw new NotFoundException('No pharmacy available');

      let total = 0;
      const itemsCreate = dto.items.map((it) => {
        const price = (it as any).price ? Number((it as any).price) : 10;
        total += price * (it.quantity ?? 1);

        return {
          medicineId: it.medicineId ?? 0,
          name:
            it.name ??
            `LT_Item_${it.medicineId ?? Math.random().toString(36)}`,
          quantity: it.quantity ?? 1,
          price,
        };
      });

      const coupon = await this.resolveCouponForSubtotal(
        customerId,
        requestedCouponCode || null,
        total,
      );
      const couponDiscount = coupon?.discount ?? 0;
      const finalTotal = Math.max(0, total - couponDiscount);

      const created = await this.prisma.$transaction(async (tx) => {
        const ord = await tx.order.create(({
          data: {
            customerId,
            pharmacyId: best,
            totalPrice: finalTotal,
            couponCode: coupon?.code ?? null,
            couponDiscount,
            status: OrderStatus.PENDING,
            paymentMode: mode,
            paymentStatus: initialPaymentStatus,
            paymentRequestedAt: initialPaymentRequestedAt,
            requiresPrescription,
            ...(delivery as any),
            items: { create: itemsCreate },
          },
          include: { items: true },
        } as any));

        if (coupon) {
          await this.recordCouponRedemption(tx, coupon.couponId, customerId, ord.id);
        }

        await tx.orderOffer.create({
          data: {
            orderId: ord.id,
            pharmacyId: best,
            offeredTo: 'PHARMACY',
          },
        });

        return ord;
      });

      await this.logTimeline(created.id, 'ORDER_CREATED', {
        loadtest: true,
        bestPharmacyId: best,
        mode,
        requiresPrescription,
      });

      this.analytics.track({
        name: 'order_created',
        userId: customerId,
        props: {
          orderId: created.id,
          paymentMode: mode,
          requiresPrescription,
          totalPrice: (created as any)?.totalPrice ?? null,
          bestPharmacyId: best,
          loadtest: true,
        },
      });

      if (mode === PaymentMode.PAY_FIRST) {
        await this.logTimeline(created.id, 'PAYMENT_REQUESTED', {
          orderId: created.id,
          paymentMode: mode,
          at: initialPaymentRequestedAt,
        });
      }

      this.notify.create(
        customerId,
        'ORDER_CREATED',
        `Order #${created.id} created`,
        { orderId: created.id, status: created.status },
      );

      this.notify.create(
        best,
        'ORDER_AVAILABLE',
        `Order #${created.id}`,
        { orderId: created.id },
        customerId,
      );
      this.ws.notifyUser(best, 'order_available', { orderId: created.id });
      this.ws.notifyUser(best, 'order.created', { order: created });

      // PAY_FIRST is disabled in minimal dev flow (handled as PAY_AFTER_ACCEPT).

      const delay =
        Number(this.config.get('ESCALATION_MINUTES') || 1) *
        60 *
        1000;
      await this.orderAssignQueue.add('rider_escalation', { orderId: created.id }, { delay });

      try { await this.geoSurge.removePoint(orderGeoId); } catch {}

      return { order: created, candidates: [best], scores: [{ pharmacyId: best, score: 1 }] };
    }

    // NORMAL MODE auto-routing
    const grouped: any[] = (await this.prisma.pharmacyInventory.groupBy({
      by: ['pharmacyId'],
      where: {
        medicineId: { in: medicineIds },
        stock: { gt: 0 },
        deletedAt: null,
      },
      _count: { medicineId: true },
    } as any)) as any;

    const pharmacyIds = grouped
      .filter((g) => Number(g?._count?.medicineId) === medicineIds.length)
      .map((g) => g.pharmacyId);

    if (!pharmacyIds.length) throw new NotFoundException('No pharmacy has all items in stock');

    const scores = pharmacyIds.map((pid) => ({ pharmacyId: pid, score: 1 }));

    const bestPharmacyId = scores[0].pharmacyId;

    const inv2 = await this.prisma.pharmacyInventory.findMany({
      where: {
        pharmacyId: bestPharmacyId,
        medicineId: { in: medicineIds },
        deletedAt: null,
      },
    } as any);

    const finalOrder = await this.prisma.$transaction(async (tx) => {
      let total = 0;
      const itemsCreate: any[] = [];

      for (const it of dto.items) {
        const row = inv2.find((r) => r.medicineId === it.medicineId);
        if (!row) throw new BadRequestException('Item not in stock');
        if (row.stock < it.quantity) throw new BadRequestException(`Low stock for ${it.medicineId}`);

        const price = Number(row.sellingPrice);
        total += price * it.quantity;

        const med = await tx.medicine.findUnique({ where: { id: it.medicineId } });
        itemsCreate.push({ medicineId: it.medicineId, name: med?.name ?? it.name ?? 'Item', quantity: it.quantity, price });
      }

      const coupon = await this.resolveCouponForSubtotal(
        customerId,
        requestedCouponCode || null,
        total,
      );
      const couponDiscount = coupon?.discount ?? 0;
      const finalTotal = Math.max(0, total - couponDiscount);

      const created = await tx.order.create(({
        data: {
          customerId,
          pharmacyId: bestPharmacyId,
          totalPrice: finalTotal,
          couponCode: coupon?.code ?? null,
          couponDiscount,
          status: OrderStatus.PENDING,
          paymentMode: mode,
          paymentStatus: initialPaymentStatus,
          paymentRequestedAt: initialPaymentRequestedAt,
          requiresPrescription,
          ...(delivery as any),
          items: { create: itemsCreate },
        },
        include: { items: true },
      } as any));

      if (coupon) {
        await this.recordCouponRedemption(tx, coupon.couponId, customerId, created.id);
      }

      // Stock is validated now, but decremented on pharmacy acceptance / fulfillment.

      for (const pid of pharmacyIds) {
        await tx.orderOffer.create({
          data: { orderId: created.id, pharmacyId: pid, offeredTo: 'PHARMACY' },
        });
      }

      return created;
    });

    await this.logTimeline(finalOrder.id, 'ORDER_CREATED', {
      candidates: pharmacyIds,
      bestPharmacyId,
      mode,
      requiresPrescription,
    });

    this.analytics.track({
      name: 'order_created',
      userId: customerId,
      props: {
        orderId: finalOrder.id,
        paymentMode: mode,
        requiresPrescription,
        totalPrice: (finalOrder as any)?.totalPrice ?? null,
        bestPharmacyId,
      },
    });

    if (mode === PaymentMode.PAY_FIRST) {
      await this.logTimeline(finalOrder.id, 'PAYMENT_REQUESTED', {
        orderId: finalOrder.id,
        paymentMode: mode,
        at: initialPaymentRequestedAt,
      });
    }

    this.notify.create(
      customerId,
      'ORDER_CREATED',
      `Order #${finalOrder.id} created`,
      { orderId: finalOrder.id, status: finalOrder.status },
    );

    for (const pid of pharmacyIds) {
      this.notify.create(pid, 'ORDER_AVAILABLE', `Order #${finalOrder.id}`, { orderId: finalOrder.id }, customerId);
      this.ws.notifyUser(pid, 'order_available', { orderId: finalOrder.id });
    }
    if (finalOrder.pharmacyId) {
      this.ws.notifyUser(finalOrder.pharmacyId, 'order.created', {
        order: finalOrder,
      });
    }

    // PAY_FIRST is disabled in minimal dev flow (handled as PAY_AFTER_ACCEPT).

    const delay2 = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
    await this.orderAssignQueue.add('rider_escalation', { orderId: finalOrder.id }, { delay: delay2 });
    try { await this.geoSurge.removePoint(orderGeoId); } catch {}

    return { order: finalOrder, candidates: pharmacyIds, scores };
  }

  // ----------------------------------------------------------
  // Upload prescription
  // ----------------------------------------------------------
  async uploadPrescription(customerId: number, url: string, attachOrderId?: number) {
    if (!url) throw new BadRequestException('Invalid URL');

    const pres = await this.prisma.prescription.create({ data: { customerId, url } });

    await this.logTimeline(attachOrderId ?? 0, 'PRESCRIPTION_UPLOADED', { url, prescriptionId: pres.id });

    if (attachOrderId) {
      try {
        await this.prisma.order.update({ where: { id: attachOrderId }, data: { prescriptionId: pres.id } });

        const order = await this.prisma.order.findUnique({ where: { id: attachOrderId } });
        if (order && order.pharmacyId) {
          this.notify.create(order.pharmacyId, 'PRESCRIPTION_UPLOADED', 'Prescription added', { orderId: order.id, prescriptionId: pres.id }, customerId);
          this.ws.notifyUser(order.pharmacyId, 'prescription_uploaded', { orderId: order.id, prescriptionId: pres.id });
          this.ws.notifyUser(order.pharmacyId, 'order.updated', {
            orderId: order.id,
            prescriptionId: pres.id,
          });
        }
      } catch (e) {
        this.logger.warn('Failed attaching prescription to order', (e as any)?.message ?? e);
      }
    }

    return pres;
  }

  // ----------------------------------------------------------
  // Pharmacy REQUEST PRESCRIPTION
  // ----------------------------------------------------------
  async pharmacyRequestPrescription(pharmacyId: number, orderId: number, message?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.pharmacyId !== pharmacyId) throw new BadRequestException('Not authorized for this order');

    await this.prisma.order.update({ where: { id: orderId }, data: { requiresPrescription: true } });

    await this.logTimeline(orderId, 'PRESCRIPTION_REQUESTED_BY_PHARMACY', { pharmacyId, message });

    this.notify.create(order.customerId, 'PRESCRIPTION_REQUIRED', message || 'Pharmacy requested a prescription for your order', { orderId }, pharmacyId);
    this.ws.notifyUser(order.customerId, 'prescription_required', { orderId, message });
    this.ws.notifyUser(pharmacyId, 'order.updated', {
      orderId,
      requiresPrescription: true,
    });

    return { ok: true };
  }

  private async transitionStatus(args: {
    orderId: number;
    actor: { id: number; role: UserRole };
    from?: OrderStatus;
    to: OrderStatus;
    event: string;
    data?: any;
    extraUpdate?: Record<string, any>;
  }) {
    return this.lifecycle.transition({
      orderId: args.orderId,
      actor: args.actor,
      from: args.from,
      to: args.to,
      event: args.event,
      data: args.data,
      extraUpdate: args.extraUpdate,
    });
  }

  // ----------------------------------------------------------
  // Pharmacy respond
  // ----------------------------------------------------------
  async pharmacyRespond(pharmacyId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED') {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true, prescription: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.pharmacyId !== pharmacyId) {
      throw new BadRequestException('Not authorized for this order');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Order cannot be ${action.toLowerCase()} from status ${order.status}`,
      );
    }

    if (action === 'ACCEPTED' && order.requiresPrescription && !order.prescriptionId) {
      throw new BadRequestException('Prescription required to accept this order');
    }

    if (action === 'REJECTED') {
      await this.prisma.orderOffer.updateMany({
        where: { orderId, pharmacyId },
        data: { status: 'REJECTED' },
      });

      return this.pharmacyReject(pharmacyId, orderId);
    }

    await this.prisma.orderOffer.updateMany({
      where: { orderId, pharmacyId: { not: pharmacyId } },
      data: { status: 'REJECTED' },
    });

    const acceptRes = await this.pharmacyAccept(pharmacyId, orderId, {});
    const updated = (acceptRes as any)?.order;

    if (!updated) return acceptRes as any;

    // only push rider/admin flow when fully accepted (not needs confirmation / rejected)
    if (String(updated.status) !== String(OrderStatus.ACCEPTED)) {
      return { order: updated };
    }

    this.ws.notifyAdmins('admin_order_override', {
      orderId,
      status: OrderStatus.ACCEPTED,
      pharmacyId,
    });
    this.ws.notifyRiders('order.available', { orderId, pharmacyId });

    // Pay-after-accept/verification: request payment (customer will pay via dev endpoint for now).
    if (
      updated.paymentMode === PaymentMode.PAY_AFTER_ACCEPT ||
      updated.paymentMode === PaymentMode.PAY_AFTER_VERIFICATION
    ) {
      await this.requestCustomerPayment(updated as any);
      return { order: updated, paymentStatus: 'REQUESTED' };
    }

    const delay = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60000;
    await this.orderAssignQueue.add('rider_escalation', { orderId }, { delay });

    return { order: updated };
  }

  // ----------------------------------------------------------
  // Rider respond
  // ----------------------------------------------------------
  async riderRespond(
    riderId: number,
    orderId: number,
    action: 'ACCEPTED' | 'REJECTED',
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (action === 'ACCEPTED') {
      const now = new Date();

      const offer = await this.prisma.orderOffer.findFirst(({
        where: {
          orderId,
          riderId,
          offeredTo: 'RIDER',
          status: 'PENDING',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: 'desc' },
      } as any));

      if (!offer) {
        throw new BadRequestException('No active offer for this order');
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const locked = await tx.order.updateMany(({
          where: {
            id: orderId,
            riderId: null,
            status: { in: [OrderStatus.ASSIGNED] },
          },
          data: { riderId, status: OrderStatus.ASSIGNED, riderAssignedAt: now },
        } as any));
        if (!locked || (locked as any).count !== 1) {
          throw new BadRequestException('Order already assigned');
        }

        await tx.orderOffer.update({
          where: { id: offer.id },
          data: { status: 'ACCEPTED', respondedAt: now },
        } as any);

        await tx.orderOffer.updateMany({
          where: { orderId, offeredTo: 'RIDER', status: 'PENDING' },
          data: {
            status: 'EXPIRED',
            respondedAt: now,
            rejectReason: 'OTHER_RIDER_ACCEPTED',
          },
        } as any);

        await tx.user.update(({
          where: { id: riderId },
          data: { riderAvailability: 'BUSY' },
        } as any));

        return tx.order.findUnique({
          where: { id: orderId },
        });
      });

      if (!updated) {
        throw new BadRequestException('Order already assigned');
      }

      await this.logTimeline(orderId, 'RIDER_ACCEPTED', { riderId, offerId: offer.id });
      this.notify.create(
        order.customerId,
        'RIDER_ASSIGNED',
        `Rider assigned for order #${orderId}`,
        { orderId, riderId },
        riderId,
      );

      // Domain event: order.assigned (durable via Notification)
      await this.notify.createDomainEvent(
        updated.customerId,
        'order.assigned',
        `Rider assigned for order #${orderId}`,
        { orderId, riderId },
        riderId,
      );
      if (updated.pharmacyId) {
        await this.notify.createDomainEvent(
          updated.pharmacyId,
          'order.assigned',
          `Rider assigned for order #${orderId}`,
          { orderId, riderId },
          riderId,
        );
      }
      await this.notify.createDomainEvent(
        riderId,
        'order.assigned',
        `You were assigned to order #${orderId}`,
        { orderId, riderId },
        riderId,
      );
      if (updated.pharmacyId) {
        this.ws.notifyUser(updated.pharmacyId, 'order.updated', {
          orderId,
          status: updated.status,
          riderId,
        });
      }

      this.ws.notifyUser(updated.customerId, 'order_status_update', {
        orderId,
        stage: OrderStatus.ASSIGNED,
        riderId,
      });

      // Admins: event bus broadcast (best-effort, replay in order timeline)
      this.ws.notifyAdmins('order.assigned', { orderId, riderId });

      return updated;
    }

    const now = new Date();
    const offer = await this.prisma.orderOffer.findFirst(({
      where: {
        orderId,
        riderId,
        offeredTo: 'RIDER',
        status: 'PENDING',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    } as any));
    if (!offer) return { ok: true };

    await this.prisma.orderOffer.update({
      where: { id: offer.id },
      data: {
        status: 'REJECTED',
        respondedAt: now,
        rejectReason: reason ? String(reason).slice(0, 200) : 'RIDER_REJECTED',
      },
    } as any);

    await this.logTimeline(orderId, 'RIDER_REJECTED', {
      riderId,
      offerId: offer.id,
      reason: reason || null,
    });
    
    // Re-queue escalation on rider rejection
    const delay =
      Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;

    const pending = await this.prisma.orderOffer.count(({
      where: {
        orderId,
        offeredTo: 'RIDER',
        status: 'PENDING',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    } as any));

    if (pending === 0) {
      await this.orderAssignQueue.add('rider_escalation', { orderId }, { delay });
    }

    try {
      await this.riderQuality.onRiderRejectedOffer(riderId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Rapid reject check failed for rider ${riderId}: ${msg}`);
    }
    
    return { ok: true };
  }

  // ----------------------------------------------------------
  // Customer rate rider
  // ----------------------------------------------------------
  async rateRider(
    customerId: number,
    orderId: number,
    dto: { rating: number; comment?: string },
  ) {
    return this.riderQuality.recordRating({
      customerId,
      orderId,
      rating: dto.rating,
      comment: dto.comment,
    });
  }

  // ----------------------------------------------------------
  // Rider report issue
  // ----------------------------------------------------------
  async riderReportIssue(
    riderId: number,
    orderId: number,
    dto: {
      type: 'CUSTOMER_UNREACHABLE' | 'ADDRESS_ISSUE' | 'PAYMENT_ISSUE' | 'OTHER';
      note?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.riderId !== riderId) throw new BadRequestException('Not your order');

    const status = order.status;
    const allowed =
      status === OrderStatus.REACHED_PHARMACY ||
      status === OrderStatus.PICKED_UP ||
      status === OrderStatus.OUT_FOR_DELIVERY;
    if (!allowed) {
      throw new BadRequestException(`Cannot report issue in status ${status}`);
    }

    const type = String(dto?.type || 'OTHER').toUpperCase();
    const note = dto?.note != null ? String(dto.note).slice(0, 300) : null;

    const loc =
      dto?.lat != null && dto?.lng != null
        ? { lat: Number(dto.lat), lng: Number(dto.lng) }
        : null;

    await this.logTimeline(orderId, 'RIDER_ISSUE', {
      riderId,
      type,
      note,
      location: loc,
      status,
    });

    this.notify.create(
      order.customerId,
      'ORDER_ISSUE',
      `Delivery issue reported for order #${orderId}`,
      { orderId, type, note },
      riderId,
    );

    if (order.pharmacyId) {
      this.notify.create(
        order.pharmacyId,
        'ORDER_ISSUE',
        `Rider reported an issue for order #${orderId}`,
        { orderId, type, note },
        riderId,
      );
    }

    this.ws.notifyUser(order.customerId, 'order.updated', {
      orderId,
      status: order.status,
      issue: { type, note },
    });

    (this.ws as any).notifyAdmins?.('order.issue', {
      orderId,
      riderId,
      type,
      note,
      status,
    });

    return { ok: true };
  }
  
  // ----------------------------------------------------------
  // Admin assign
  // ----------------------------------------------------------
  async adminAssign(orderId: number, adminId: number, riderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (!this.isEscalatable(order.status)) {
      throw new BadRequestException(
        `Order cannot be assigned in status ${order.status}`,
      );
    }

    const rider = await this.prisma.user.findUnique({
      where: { id: riderId },
    });
    if (!rider || rider.role !== UserRole.RIDER) {
      throw new BadRequestException('Invalid rider');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: riderId },
        data: ({ riderAvailability: 'BUSY' } as any),
      });

      const res = await this.lifecycle.forceStatus({
        orderId,
        actor: { id: adminId, role: UserRole.ADMIN },
        to: OrderStatus.ASSIGNED,
        event: 'ASSIGNED_BY_ADMIN',
        data: { adminId, riderId },
        extraUpdate: { riderId, riderAssignedAt: now },
        db: tx as any,
      } as any);

      return res.order;
    });

    this.notify.create(
      updated.customerId,
      'ORDER_ASSIGNED_BY_ADMIN',
      `Order #${orderId} assigned`,
      { orderId },
      adminId,
    );
    this.notify.create(
      updated.customerId,
      'RIDER_ASSIGNED',
      `Rider assigned for order #${orderId}`,
      { orderId, riderId },
      adminId,
    );

    this.ws.notifyUser(updated.customerId, 'order_status_update', {
      orderId,
      stage: OrderStatus.ASSIGNED,
    });
    if (order.pharmacyId) {
      this.ws.notifyUser(order.pharmacyId, 'order.updated', {
        orderId,
        status: OrderStatus.ASSIGNED,
        riderId,
      });
    }

    await this.notify.createDomainEvent(
      updated.customerId,
      'order.assigned',
      `Rider assigned for order #${orderId}`,
      { orderId, riderId },
      adminId,
    );
    if (order.pharmacyId) {
      await this.notify.createDomainEvent(
        order.pharmacyId,
        'order.assigned',
        `Rider assigned for order #${orderId}`,
        { orderId, riderId },
        adminId,
      );
    }
    await this.notify.createDomainEvent(
      riderId,
      'order.assigned',
      `You were assigned to order #${orderId}`,
      { orderId, riderId },
      adminId,
    );
    this.ws.notifyAdmins('order.assigned', { orderId, riderId, by: 'ADMIN' });

    return updated;
  }

  // ----------------------------------------------------------
  // Rider stage update
  // ----------------------------------------------------------
  async updateStage(
    riderId: number,
    orderId: number,
    stage: OrderStatus,
    location?: { lat?: number; lng?: number },
    proof?: { proofUrl?: string; signatureUrl?: string; otp?: string },
  ) {
    if (!Object.values(OrderStatus).includes(stage)) {
      throw new BadRequestException('Invalid order stage');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.riderId !== riderId)
      throw new BadRequestException('Not your order');

    // State machine enforcement:
    // ASSIGNED → REACHED_PHARMACY → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
    const current = order.status;

    // Allow location-only updates by sending the same stage.
    const isNoopStage = stage === current;

    const allowed =
      isNoopStage ||
      (current === OrderStatus.ASSIGNED && stage === OrderStatus.REACHED_PHARMACY) ||
      (current === OrderStatus.PICKED_UP && stage === OrderStatus.OUT_FOR_DELIVERY) ||
      (current === OrderStatus.OUT_FOR_DELIVERY && stage === OrderStatus.DELIVERED);

    // Rider cannot mark PICKED_UP (pharmacy confirms handover) or jump states.
    if (!allowed || stage === OrderStatus.PICKED_UP) {
      throw new BadRequestException(
        `Invalid stage transition ${current} → ${stage}`,
      );
    }

    const now = new Date();
    let stageAfter: any = stage;
    let changed = false;

    if (!isNoopStage) {
      const extraUpdate: any = {};
      if (stage === OrderStatus.REACHED_PHARMACY) extraUpdate.reachedPharmacyAt = now;
      if (stage === OrderStatus.OUT_FOR_DELIVERY) extraUpdate.outForDeliveryAt = now;
      if (stage === OrderStatus.DELIVERED) extraUpdate.deliveredAt = now;

      if (stage === OrderStatus.DELIVERED) {
        const proofUrl =
          proof?.proofUrl != null ? String(proof.proofUrl).trim() : '';
        const signatureUrl =
          proof?.signatureUrl != null ? String(proof.signatureUrl).trim() : '';
        const otp = proof?.otp != null ? String(proof.otp).trim() : '';

        if (proofUrl) {
          if (proofUrl.length > 1000) {
            throw new BadRequestException('proofUrl too long');
          }
          if (!/^https?:\/\//i.test(proofUrl)) {
            throw new BadRequestException('proofUrl must be a valid URL');
          }
          extraUpdate.deliveryProofUrl = proofUrl;
        }

        if (signatureUrl) {
          if (signatureUrl.length > 1000) {
            throw new BadRequestException('signatureUrl too long');
          }
          extraUpdate.deliverySignatureUrl = signatureUrl;
        }

        if (otp) {
          if (otp.length > 20) throw new BadRequestException('otp too long');
          extraUpdate.deliveryOtp = otp;
        }
      }

      const event =
        stage === OrderStatus.REACHED_PHARMACY
          ? 'REACHED_PHARMACY'
          : stage === OrderStatus.OUT_FOR_DELIVERY
            ? 'OUT_FOR_DELIVERY'
            : stage === OrderStatus.DELIVERED
              ? 'DELIVERED'
              : `STAGE_${String(stage)}`;

      const res = await this.transitionStatus({
        orderId,
        actor: { id: riderId, role: UserRole.RIDER },
        from: current as any,
        to: stage,
        event,
        data: {
          riderId,
          proofUrl: extraUpdate.deliveryProofUrl ?? null,
          signatureUrl: extraUpdate.deliverySignatureUrl ?? null,
          otpProvided: extraUpdate.deliveryOtp ? true : false,
        },
        extraUpdate,
      });

      changed = res.changed;
      stageAfter = (res.order as any)?.status ?? stage;
    }

    // Domain event: rider.arrived (when rider reaches pharmacy)
    if (changed && String(stageAfter) === String(OrderStatus.REACHED_PHARMACY)) {
      await this.logTimeline(orderId, 'RIDER_ARRIVED', { riderId });

      await this.notify.createDomainEvent(
        order.customerId,
        'rider.arrived',
        `Rider arrived at pharmacy for order #${orderId}`,
        { orderId, riderId },
        riderId,
      );
      if (order.pharmacyId) {
        await this.notify.createDomainEvent(
          order.pharmacyId,
          'rider.arrived',
          `Rider arrived for order #${orderId}`,
          { orderId, riderId },
          riderId,
        );
      }

      this.ws.notifyAdmins('rider.arrived', { orderId, riderId });
    }

    if (stage === OrderStatus.DELIVERED && changed) {
      await this.prisma.user.update(({
        where: { id: riderId },
        data: { riderAvailability: 'AVAILABLE' },
      } as any));

      try {
        await this.riderPayments.ensureDeliveryEarningForOrder(orderId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Rider earning create failed for order ${orderId}: ${msg}`);
      }

      try {
        await this.geoSurge.removePoint(`order:${orderId}`);
      } catch {}

      this.notify.create(
        order.customerId,
        'ORDER_DELIVERED',
        `Order #${orderId} delivered.`,
        { orderId },
        riderId,
      );
    }

    if (location?.lat != null && location?.lng != null) {
      await this.prisma.user.update({
        where: { id: riderId },
        data: {
          latitude: location.lat,
          longitude: location.lng,
        },
      });
    }

    this.ws.notifyUser(order.customerId, 'order_status_update', {
      orderId,
      stage: stageAfter,
      location,
    });
    if (order.pharmacyId) {
      this.ws.notifyUser(order.pharmacyId, 'order.updated', {
        orderId,
        status: stageAfter,
        location,
      });
    }

    return { ok: true };
  }

  // ----------------------------------------------------------
  // Find orders by user
  // ----------------------------------------------------------
  async findByUser(userId: number, role: string) {
    const baseInclude: any = { items: true, prescription: true };
    const withUsers: any = {
      customer: { select: { id: true, name: true, phone: true, latitude: true, longitude: true } },
      pharmacy: { select: { id: true, name: true, phone: true, latitude: true, longitude: true } },
      rider: { select: { id: true, name: true, phone: true, latitude: true, longitude: true } },
    };

    if (role === UserRole.ADMIN) {
      return this.prisma.order.findMany({
        include: { ...baseInclude, ...withUsers },
      });
    }

    if (role === UserRole.PHARMACY) {
      return this.prisma.order.findMany({
        where: { pharmacyId: userId },
        include: { ...baseInclude, customer: withUsers.customer, rider: withUsers.rider },
      });
    }

    if (role === UserRole.RIDER) {
      return this.prisma.order.findMany({
        where: { riderId: userId },
        include: { ...baseInclude, customer: withUsers.customer, pharmacy: withUsers.pharmacy },
      });
    }

    return this.prisma.order.findMany({
      where: { customerId: userId },
      include: { ...baseInclude, pharmacy: withUsers.pharmacy, rider: withUsers.rider },
    });
  }

  async getForUser(userId: number, role: string, orderId: number) {
    const baseInclude: any = { items: true, prescription: true };
    const withUsers: any = {
      customer: { select: { id: true, name: true, phone: true, latitude: true, longitude: true } },
      pharmacy: { select: { id: true, name: true, phone: true, latitude: true, longitude: true } },
      rider: { select: { id: true, name: true, phone: true, latitude: true, longitude: true } },
    };

    if (role === UserRole.ADMIN) {
      return this.prisma.order.findFirst({
        where: { id: orderId },
        include: { ...baseInclude, ...withUsers },
      });
    }

    if (role === UserRole.PHARMACY) {
      return this.prisma.order.findFirst({
        where: { id: orderId, pharmacyId: userId },
        include: { ...baseInclude, customer: withUsers.customer, rider: withUsers.rider },
      });
    }

    if (role === UserRole.RIDER) {
      return this.prisma.order.findFirst({
        where: { id: orderId, riderId: userId },
        include: { ...baseInclude, customer: withUsers.customer, pharmacy: withUsers.pharmacy },
      });
    }

    return this.prisma.order.findFirst({
      where: { id: orderId, customerId: userId },
      include: { ...baseInclude, pharmacy: withUsers.pharmacy, rider: withUsers.rider },
    });
  }

  // ----------------------------------------------------------
  // Pharmacy orders
  // ----------------------------------------------------------
  async listForPharmacy(pharmacyId: number, status?: OrderStatus) {
    const where: any = { pharmacyId };
    if (status && Object.values(OrderStatus).includes(status)) {
      where.status = status;
    }

    return this.prisma.order.findMany({
      where,
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
        rider: {
          select: { id: true, name: true, phone: true, latitude: true, longitude: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForPharmacy(pharmacyId: number, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, pharmacyId },
      include: {
        items: true,
        prescription: true,
        timeline: { orderBy: { createdAt: 'asc' } },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
        rider: {
          select: { id: true, name: true, phone: true, latitude: true, longitude: true },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async pharmacyAccept(
    pharmacyId: number,
    orderId: number,
    dto?: PharmacyAcceptDto,
  ) {
    const order: any = await (this.prisma as any).order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.pharmacyId !== pharmacyId)
      throw new BadRequestException('Not authorized for this order');

    // Idempotent: do not re-price / re-decrement inventory on repeated calls.
    if (order.status !== OrderStatus.PENDING) {
      return { order };
    }

    const manualMap = new Map<number, { price: number; note?: string }>();
    for (const it of dto?.manualItems ?? []) {
      manualMap.set(Number(it.orderItemId), {
        price: Number(it.price),
        note: it.note,
      });
    }

    const medicineIds = (order.items || [])
      .map((i: any) => i.medicineId)
      .filter((v: any): v is number => typeof v === 'number');

    const inv = await this.prisma.pharmacyInventory.findMany(({
      where: { pharmacyId, medicineId: { in: medicineIds }, deletedAt: null },
      select: {
        id: true,
        medicineId: true,
        sellingPrice: true,
        discount: true,
        stock: true,
      },
    } as any));
    const invMap = new Map<
      number,
      { inventoryId: number; price: number; discount: number; stock: number }
    >();
    for (const row of inv as any[]) {
      invMap.set(Number(row.medicineId), {
        inventoryId: Number(row.id),
        price: Number(row.sellingPrice),
        discount: Number(row.discount ?? 0),
        stock: Number(row.stock ?? 0),
      });
    }

    const pricedItems: any[] = [];
    const missingItems: any[] = [];
    const stockAllocations: Array<{
      inventoryId: number;
      medicineId: number;
      quantity: number;
      requestedQuantity: number;
    }> = [];
    let subtotal = 0;

    for (const item of order.items || []) {
      const manual = manualMap.get(item.id);
      if (manual) {
        const price = Number(manual.price);
        pricedItems.push({
          orderItemId: item.id,
          medicineId: item.medicineId ?? null,
          name: item.name,
          quantity: item.quantity,
          price,
          source: 'manual',
          discount: null,
          note: manual.note,
        });
        subtotal += price * Number(item.quantity || 1);
        continue;
      }

      const medicineId = item.medicineId ?? undefined;
      if (medicineId && invMap.has(Number(medicineId))) {
        const row = invMap.get(Number(medicineId))!;

        const requestedQty = Number(item.quantity || 1);
        const availableQty = Math.max(0, Number(row.stock ?? 0));
        const fulfillQty = Math.min(requestedQty, availableQty);

        if (fulfillQty <= 0) {
          missingItems.push({
            orderItemId: item.id,
            medicineId,
            name: item.name,
            requestedQuantity: requestedQty,
            availableStock: availableQty,
            reason: 'INSUFFICIENT_STOCK',
          });
          continue;
        }

        const price = Number(row.price);
        pricedItems.push({
          orderItemId: item.id,
          medicineId,
          name: item.name,
          quantity: fulfillQty,
          requestedQuantity: requestedQty,
          price,
          source: 'inventory',
          discount: row.discount,
        });
        subtotal += price * fulfillQty;
        stockAllocations.push({
          inventoryId: row.inventoryId,
          medicineId,
          quantity: fulfillQty,
          requestedQuantity: requestedQty,
        });
        continue;
      }

      // keep current price but require confirmation for missing inventory item
      missingItems.push({
        orderItemId: item.id,
        medicineId: item.medicineId ?? null,
        name: item.name,
        quantity: item.quantity,
        currentPrice: item.price,
        reason: 'NOT_IN_INVENTORY',
      });
      subtotal += Number(item.price) * Number(item.quantity || 1);
    }

    const needsConfirmation =
      missingItems.length > 0 ||
      stockAllocations.some((a) => a.quantity !== a.requestedQuantity) ||
      pricedItems.some((p) => p.source === 'manual') ||
      (dto?.totalPrice != null &&
        Number.isFinite(Number(dto.totalPrice)) &&
        Number(dto.totalPrice) !== subtotal);

    if (dto?.totalPrice != null && Number.isFinite(Number(dto.totalPrice))) {
      subtotal = Number(dto.totalPrice);
    }

    let couponDiscount = Number(order.couponDiscount ?? 0);
    if (order.couponCode) {
      const code = String(order.couponCode).trim().toUpperCase();
      const coupon = code ? await (this.prisma as any).coupon.findUnique({ where: { code } }) : null;

      if (!coupon) {
        couponDiscount = 0;
      } else {
        const min = coupon.minOrder != null ? Number(coupon.minOrder) : null;
        if (min != null && subtotal < min) {
          couponDiscount = 0;
        } else {
          if (String(coupon.type).toUpperCase() === COUPON_TYPE.FLAT) {
            couponDiscount = Number(coupon.amount);
          } else {
            const pct = Math.max(0, Math.min(100, Number(coupon.amount)));
            couponDiscount = (subtotal * pct) / 100;
          }

          const max = coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null;
          if (max != null) couponDiscount = Math.min(couponDiscount, max);
          couponDiscount = Math.max(0, Math.min(couponDiscount, subtotal));
        }
      }
    }

    const total = Math.max(0, subtotal - couponDiscount);

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const p of pricedItems) {
        const data: any = { price: Number(p.price) };
        if (
          Number.isFinite(Number(p.requestedQuantity)) &&
          Number.isFinite(Number(p.quantity)) &&
          Number(p.quantity) !== Number(p.requestedQuantity)
        ) {
          data.quantity = Number(p.quantity);
        }
        await tx.orderItem.update({
          where: { id: p.orderItemId },
          data,
        });
      }

      for (const a of stockAllocations) {
        const res = await tx.pharmacyInventory.updateMany(({
          where: {
            id: a.inventoryId,
            deletedAt: null,
            stock: { gte: a.quantity },
          },
          data: { stock: { decrement: a.quantity } },
        } as any));

        if (!res || (res as any).count !== 1) {
          throw new BadRequestException(
            `Insufficient stock for medicine ${a.medicineId}`,
          );
        }
      }

      if (pricedItems.length === 0) {
        const { order: updated } = await this.lifecycle.transition({
          orderId,
          actor: { id: pharmacyId, role: UserRole.PHARMACY },
          from: OrderStatus.PENDING,
          to: OrderStatus.REJECTED,
          event: 'PHARMACY_REJECTED_OUT_OF_STOCK',
          data: { pharmacyId, missingItems },
          db: tx as any,
        });
        return updated as any;
      }

      const nextStatus = needsConfirmation
        ? NEEDS_CONFIRMATION_STATUS
        : OrderStatus.ACCEPTED;

      // Use the lifecycle service for the status update (single source of truth).
      const { order: updated } = await this.lifecycle.transition({
        orderId,
        actor: { id: pharmacyId, role: UserRole.PHARMACY },
        from: OrderStatus.PENDING,
        to: nextStatus as any,
        event: nextStatus === NEEDS_CONFIRMATION_STATUS ? 'ORDER_NEEDS_CONFIRMATION' : 'PHARMACY_ACCEPTED',
        data: {
          pharmacyId,
          subtotal,
          couponCode: order.couponCode ?? null,
          couponDiscount,
          totalPrice: total,
          pricedItems,
          missingItems,
          needsConfirmation,
        },
        extraUpdate: { totalPrice: total, couponDiscount },
        db: tx as any,
      });

      return updated as any;
    });

    // If order was rejected due to stock, lifecycle already wrote timeline + status.
    if (String((updated as any).status) === String(OrderStatus.REJECTED)) {
      this.notify.create(
        order.customerId,
        'ORDER_REJECTED',
        `Order #${orderId} rejected (out of stock)`,
        { orderId, missingItems },
        pharmacyId,
      );
      this.ws.notifyUser(order.customerId, 'order_status_update', {
        orderId,
        stage: OrderStatus.REJECTED,
      });
      this.ws.notifyUser(pharmacyId, 'order.updated', {
        orderId,
        status: OrderStatus.REJECTED,
      });
      return { order: updated };
    }

    const ttAcceptSec = order?.createdAt
      ? Math.max(0, Math.floor((Date.now() - order.createdAt.getTime()) / 1000))
      : null;

    // Keep enriched pricing timeline (separate from status transition event).
    await this.logTimeline(orderId, 'PHARMACY_PRICED', {
      pharmacyId,
      subtotal,
      couponCode: order.couponCode ?? null,
      couponDiscount,
      totalPrice: total,
      pricedItems,
      missingItems,
      needsConfirmation,
      ttAcceptSec,
    });

    if (needsConfirmation) {
      this.notify.create(
        order.customerId,
        'ORDER_NEEDS_CONFIRMATION',
        `Order #${orderId} has price changes. Please confirm.`,
        { orderId, totalPrice: total, pricedItems, missingItems },
        pharmacyId,
      );

      this.ws.notifyUser(order.customerId, 'order_needs_confirmation', {
        orderId,
        totalPrice: total,
        pricedItems,
        missingItems,
      });
    } else {
      this.notify.create(
        order.customerId,
        'ORDER_ACCEPTED',
        `Order #${orderId} accepted by pharmacy`,
        { orderId, totalPrice: total },
        pharmacyId,
      );

      this.ws.notifyUser(order.customerId, 'order_status_update', {
        orderId,
        stage: OrderStatus.ACCEPTED,
      });

      if (
        String(order.paymentMode) === String(PaymentMode.PAY_AFTER_ACCEPT)
      ) {
        await this.requestCustomerPayment({
          id: orderId,
          customerId: order.customerId,
          pharmacyId,
          status: OrderStatus.ACCEPTED,
          paymentMode: order.paymentMode,
          paymentStatus: (updated as any).paymentStatus,
        } as any);
      }
    }

    this.ws.notifyUser(pharmacyId, 'order.updated', {
      orderId,
      status: updated.status,
      totalPrice: Number(updated.totalPrice),
      needsConfirmation,
    });

    return { order: updated };
  }

  async pharmacyReject(pharmacyId: number, orderId: number, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.pharmacyId !== pharmacyId)
      throw new BadRequestException('Not authorized for this order');

    const ttAcceptSec = order?.createdAt
      ? Math.max(0, Math.floor((Date.now() - order.createdAt.getTime()) / 1000))
      : null;

    if (order.status !== OrderStatus.PENDING) {
      // idempotent success
      if (order.status === OrderStatus.REJECTED) return { ok: true };
      throw new BadRequestException(
        `Cannot reject order in status ${order.status}`,
      );
    }

    const { changed } = await this.transitionStatus({
      orderId,
      actor: { id: pharmacyId, role: UserRole.PHARMACY },
      from: OrderStatus.PENDING,
      to: OrderStatus.REJECTED,
      event: 'PHARMACY_REJECTED',
      data: { pharmacyId, reason, ttAcceptSec },
    });

    if (!changed) return { ok: true };

    this.notify.create(
      order.customerId,
      'ORDER_REJECTED',
      `Order #${orderId} rejected by pharmacy`,
      { orderId, reason },
      pharmacyId,
    );

    this.ws.notifyUser(order.customerId, 'order_status_update', {
      orderId,
      stage: OrderStatus.REJECTED,
      reason,
    });
    this.ws.notifyUser(pharmacyId, 'order.updated', {
      orderId,
      status: OrderStatus.REJECTED,
    });
    (this.ws as any).notifyAdmins?.('admin_order_override', {
      orderId,
      status: OrderStatus.REJECTED,
      pharmacyId,
      reason,
    });

    return { ok: true };
  }

  async pharmacyMarkReady(pharmacyId: number, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { prescription: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.pharmacyId !== pharmacyId)
      throw new BadRequestException('Not authorized for this order');

    // ACCEPTED → READY
    if (order.status !== OrderStatus.ACCEPTED) {
      if (order.status === OrderStatus.ASSIGNED) return { order };
      throw new BadRequestException(
        `Cannot mark ready in status ${order.status}`,
      );
    }

    if (
      order.paymentMode === PaymentMode.PAY_AFTER_ACCEPT ||
      order.paymentMode === PaymentMode.PAY_AFTER_VERIFICATION
    ) {
      const ps = String((order as any).paymentStatus || 'UNPAID').toUpperCase();
      if (ps !== 'PAID') {
        throw new BadRequestException('Payment required before marking ready');
      }
    }

    if (order.requiresPrescription) {
      if (!order.prescriptionId || !order.prescription) {
        throw new BadRequestException('Prescription required for this order');
      }
      if (!order.prescription.verified) {
        throw new BadRequestException('Prescription must be verified first');
      }
    }

    const { order: updated, changed } = await this.transitionStatus({
      orderId,
      actor: { id: pharmacyId, role: UserRole.PHARMACY },
      from: OrderStatus.ACCEPTED,
      to: OrderStatus.ASSIGNED,
      event: 'PHARMACY_READY',
      data: { pharmacyId },
    });

    if (changed) {
      const delay = 0;
      await this.orderAssignQueue.add(
        'rider_escalation',
        { orderId },
        { delay },
      );

      this.ws.notifyAdmins('order_ready', { orderId });
      this.ws.notifyUser(order.customerId, 'order_status_update', {
        orderId,
        stage: OrderStatus.ASSIGNED,
      });
      this.ws.notifyUser(pharmacyId, 'order.updated', {
        orderId,
        status: OrderStatus.ASSIGNED,
      });
    }

    return { order: updated };
  }

  async pharmacyConfirmHandover(pharmacyId: number, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.pharmacyId !== pharmacyId)
      throw new BadRequestException('Not authorized for this order');
    if (!order.riderId)
      throw new BadRequestException('Rider not assigned yet');

    if (order.status !== OrderStatus.REACHED_PHARMACY) {
      if (order.status === OrderStatus.PICKED_UP) return { order };
      throw new BadRequestException(
        `Cannot confirm handover in status ${order.status}`,
      );
    }

    const now = new Date();
    const { order: updated, changed } = await this.transitionStatus({
      orderId,
      actor: { id: pharmacyId, role: UserRole.PHARMACY },
      from: OrderStatus.REACHED_PHARMACY,
      to: OrderStatus.PICKED_UP,
      event: 'PICKED_UP',
      data: { pharmacyId, riderId: order.riderId, source: 'pharmacy_confirm_handover' },
      extraUpdate: { pickedUpAt: now },
    });

    if (changed) {
      await this.logTimeline(orderId, 'PHARMACY_HANDOVER_CONFIRMED', {
        pharmacyId,
        riderId: order.riderId,
      });
    }

    if (changed) {
      this.notify.create(
        order.customerId,
        'ORDER_PICKED_UP',
        `Order #${orderId} picked up`,
        { orderId, riderId: order.riderId },
        pharmacyId,
      );

      this.ws.notifyUser(order.customerId, 'order_status_update', {
        orderId,
        stage: OrderStatus.PICKED_UP,
      });

      this.ws.notifyUser(order.riderId, 'order_status_update', {
        orderId,
        stage: OrderStatus.PICKED_UP,
      });

      this.ws.notifyUser(pharmacyId, 'order.updated', {
        orderId,
        status: OrderStatus.PICKED_UP,
        riderId: order.riderId,
      });

      this.ws.notifyAdmins('admin_order_override', {
        orderId,
        status: OrderStatus.PICKED_UP,
        pharmacyId,
        riderId: order.riderId,
      });
    }

    return { order: updated };
  }

  async pharmacyVerifyPrescription(pharmacyId: number, orderId: number) {
    const order: any = await (this.prisma as any).order.findUnique({
      where: { id: orderId },
      include: { prescription: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.pharmacyId !== pharmacyId)
      throw new BadRequestException('Not authorized for this order');
    if (!order.prescriptionId || !order.prescription)
      throw new BadRequestException('No prescription uploaded');

    if (
      order.prescription.verified ||
      String(order.prescription.status).toUpperCase() ===
        PRESCRIPTION_STATUS.APPROVED
    ) {
      return { ok: true, verified: true };
    }

    await (this.prisma as any).prescription.update({
      where: { id: order.prescriptionId },
      data: {
        verified: true,
        status: PRESCRIPTION_STATUS.APPROVED as any,
        verifiedAt: new Date(),
        rejectedAt: null,
        rejectedReason: null,
      },
    });

    // If payment is configured after verification, request it now (minimal flow).
    if (
      order.paymentMode === PaymentMode.PAY_AFTER_VERIFICATION &&
      String(order.status) === String(OrderStatus.ACCEPTED)
    ) {
      await this.requestCustomerPayment(order as any);
    }

    await this.logTimeline(orderId, 'PRESCRIPTION_VERIFIED', {
      by: 'PHARMACY',
      pharmacyId,
      prescriptionId: order.prescriptionId,
    });

    this.notify.create(
      order.customerId,
      'PRESCRIPTION_VERIFIED',
      `Prescription verified for order #${orderId}`,
      { orderId, prescriptionId: order.prescriptionId },
      pharmacyId,
    );

    this.ws.notifyUser(order.customerId, 'prescription_verified', {
      orderId,
      prescriptionId: order.prescriptionId,
    });
    this.ws.notifyUser(pharmacyId, 'order.updated', {
      orderId,
      prescriptionId: order.prescriptionId,
      prescriptionVerified: true,
    });

    return { ok: true, verified: true };
  }

  async adminVerifyPrescription(orderId: number, adminId: number) {
    const order: any = await (this.prisma as any).order.findUnique({
      where: { id: orderId },
      include: { prescription: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.prescriptionId || !order.prescription)
      throw new BadRequestException('No prescription uploaded');

    if (
      !order.prescription.verified ||
      String(order.prescription.status).toUpperCase() !==
        PRESCRIPTION_STATUS.APPROVED
    ) {
      await (this.prisma as any).prescription.update({
        where: { id: order.prescriptionId },
        data: {
          verified: true,
          status: PRESCRIPTION_STATUS.APPROVED as any,
          verifiedAt: new Date(),
          rejectedAt: null,
          rejectedReason: null,
        },
      });
    }

    await this.logTimeline(orderId, 'PRESCRIPTION_VERIFIED', {
      by: 'ADMIN',
      adminId,
      prescriptionId: order.prescriptionId,
    });

    this.notify.create(
      order.customerId,
      'PRESCRIPTION_VERIFIED',
      `Prescription verified for order #${orderId}`,
      { orderId, prescriptionId: order.prescriptionId },
      adminId,
    );

    this.ws.notifyUser(order.customerId, 'prescription_verified', {
      orderId,
      prescriptionId: order.prescriptionId,
    });
    if (order.pharmacyId) {
      this.ws.notifyUser(order.pharmacyId, 'order.updated', {
        orderId,
        prescriptionId: order.prescriptionId,
        prescriptionVerified: true,
      });
    }

    return { ok: true, verified: true };
  }

  async pharmacyRejectPrescription(pharmacyId: number, orderId: number, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { prescription: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.pharmacyId !== pharmacyId) {
      throw new BadRequestException('Not authorized for this order');
    }
    if (!order.prescriptionId || !order.prescription) {
      throw new BadRequestException('No prescription uploaded');
    }

    await (this.prisma as any).prescription.update({
      where: { id: order.prescriptionId },
      data: {
        verified: false,
        status: PRESCRIPTION_STATUS.REJECTED as any,
        rejectedAt: new Date(),
        rejectedReason: reason ? String(reason).trim().slice(0, 500) : null,
        verifiedAt: null,
      },
    });

    await this.logTimeline(orderId, 'PRESCRIPTION_REJECTED', {
      by: 'PHARMACY',
      pharmacyId,
      prescriptionId: order.prescriptionId,
      reason: reason ? String(reason).trim() : undefined,
    });

    this.notify.createDomainEvent(
      order.customerId,
      'prescription.rejected',
      `Prescription rejected for order #${orderId}`,
      { orderId, prescriptionId: order.prescriptionId, reason: reason || '' },
      pharmacyId,
    );

    this.ws.notifyUser(order.customerId, 'prescription_rejected', {
      orderId,
      prescriptionId: order.prescriptionId,
      reason: reason || '',
    });
    this.ws.notifyUser(pharmacyId, 'order.updated', {
      orderId,
      prescriptionId: order.prescriptionId,
      prescriptionVerified: false,
    });

    return { ok: true, rejected: true };
  }

  async adminRejectPrescription(orderId: number, adminId: number, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { prescription: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.prescriptionId || !order.prescription) {
      throw new BadRequestException('No prescription uploaded');
    }

    await (this.prisma as any).prescription.update({
      where: { id: order.prescriptionId },
      data: {
        verified: false,
        status: PRESCRIPTION_STATUS.REJECTED as any,
        rejectedAt: new Date(),
        rejectedReason: reason ? String(reason).trim().slice(0, 500) : null,
        verifiedAt: null,
      },
    });

    await this.logTimeline(orderId, 'PRESCRIPTION_REJECTED', {
      by: 'ADMIN',
      adminId,
      prescriptionId: order.prescriptionId,
      reason: reason ? String(reason).trim() : undefined,
    });

    this.notify.createDomainEvent(
      order.customerId,
      'prescription.rejected',
      `Prescription rejected for order #${orderId}`,
      { orderId, prescriptionId: order.prescriptionId, reason: reason || '' },
      adminId,
    );

    this.ws.notifyUser(order.customerId, 'prescription_rejected', {
      orderId,
      prescriptionId: order.prescriptionId,
      reason: reason || '',
    });
    if (order.pharmacyId) {
      this.ws.notifyUser(order.pharmacyId, 'order.updated', {
        orderId,
        prescriptionId: order.prescriptionId,
        prescriptionVerified: false,
      });
    }

    return { ok: true, rejected: true };
  }

  // ----------------------------------------------------------
  // Timeline
  // ----------------------------------------------------------
  async getTimeline(orderId: number) {
    const events = await this.prisma.orderTimeline.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    return events.map((e) => ({
      event: e.event,
      data: e.data ? JSON.parse(e.data) : {},
      at: e.createdAt,
    }));
  }

  async getTimelineForUser(userId: number, role: string, orderId: number) {
    if (!Number.isFinite(orderId)) throw new BadRequestException('Invalid order');
    const r = String(role || '').toUpperCase();

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, pharmacyId: true, riderId: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const allowed =
      r === String(UserRole.ADMIN) ||
      order.customerId === userId ||
      order.pharmacyId === userId ||
      (order.riderId != null && order.riderId === userId);

    if (!allowed) throw new BadRequestException('Not authorized for this order');

    const raw = await this.getTimeline(orderId);

    if (r !== String(UserRole.CUSTOMER)) return raw;

    // Customer timeline should not expose internal ops/penalty/SLA details.
    const hiddenExact = new Set<string>([
      'PHARMACY_SLA_BREACHED',
      'PHARMACY_SLA_WARNING',
      'ORDER_ESCALATION',
      'ORDER_OFFER_CREATED',
      'OFFER_DISPATCHED',
      'OFFER_EXPIRED',
      'RIDER_RAPID_REJECT',
      'RIDER_REJECTED',
      'ADMIN_FORCE_STATUS',
      'ADMIN_FORCE_CANCEL',
      'ADMIN_UNASSIGNED_RIDER',
      'ASSIGNED_BY_ADMIN',
      'ADMIN_SETTLED_ORDER',
      'ADMIN_UNSETTLED_ORDER',
    ]);

    return raw.filter((e) => {
      const ev = String(e?.event || '').toUpperCase();
      if (!ev) return false;
      if (hiddenExact.has(ev)) return false;
      if (ev.startsWith('ADMIN_')) return false;
      if (ev.includes('SLA')) return false;
      if (ev.includes('OFFER')) return false;
      if (ev.includes('ESCALAT')) return false;
      // Hide raw penalty/quality signals from customer view
      if (ev.includes('PENALTY') || ev.includes('STRIKE') || ev.includes('FRAUD'))
        return false;
      return true;
    });
  }

  async getTrackingForUser(userId: number, role: string, orderId: number) {
    if (!Number.isFinite(orderId)) throw new BadRequestException('Invalid order');
    const r = String(role || '').toUpperCase();

    const order: any = await (this.prisma as any).order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        pharmacyId: true,
        riderId: true,
        status: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
        updatedAt: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const allowed =
      r === String(UserRole.ADMIN) ||
      order.customerId === userId ||
      order.pharmacyId === userId ||
      (order.riderId != null && order.riderId === userId);
    if (!allowed) throw new BadRequestException('Not authorized for this order');

    const rider =
      order.riderId != null
        ? await this.prisma.user.findUnique({
            where: { id: order.riderId },
            select: { id: true, latitude: true, longitude: true, updatedAt: true },
          })
        : null;

    const riderLat = rider?.latitude != null ? Number(rider.latitude) : null;
    const riderLon = rider?.longitude != null ? Number(rider.longitude) : null;
    const destLat =
      order.deliveryLatitude != null ? Number(order.deliveryLatitude) : null;
    const destLon =
      order.deliveryLongitude != null ? Number(order.deliveryLongitude) : null;

    let distanceKm: number | null = null;
    let etaMinutes: number | null = null;
    if (
      riderLat != null &&
      riderLon != null &&
      destLat != null &&
      destLon != null
    ) {
      distanceKm = this.haversineKm(riderLat, riderLon, destLat, destLon);
      const speedKmph = Number(process.env.ETA_SPEED_KMPH ?? 25);
      if (Number.isFinite(speedKmph) && speedKmph > 0) {
        etaMinutes = Math.max(1, Math.round((distanceKm / speedKmph) * 60));
      }
    }

    return {
      orderId: order.id,
      status: order.status,
      rider: rider
        ? {
            id: rider.id,
            latitude: riderLat,
            longitude: riderLon,
            updatedAt: rider.updatedAt,
          }
        : null,
      destination:
        destLat != null && destLon != null
          ? { latitude: destLat, longitude: destLon }
          : null,
      distanceKm,
      etaMinutes,
      updatedAt: order.updatedAt,
    };
  }

  // ----------------------------------------------------------
  // Simple rider score
  // ----------------------------------------------------------
  async getRiderScorePublic(
    rp: { memberId: string; distKm?: number; meta?: any },
    lat?: number | null,
    lon?: number | null,
  ) {
    let base = 50;

    if (typeof rp.distKm === 'number') {
      base = Math.max(
        1,
        Math.round(Math.max(0, 100 - rp.distKm * 10)),
      );
    } else if (lat != null && lon != null && rp.meta?.lat && rp.meta?.lon) {
      try {
        const km = this.haversineKm(
          Number(rp.meta.lat),
          Number(rp.meta.lon),
          lat,
          lon,
        );
        base = Math.max(
          1,
          Math.round(Math.max(0, 100 - km * 10)),
        );
      } catch {
        base = 10;
      }
    } else {
      base = 10;
    }

    try {
      const match = (rp.memberId || '').match(/^rider:(\d+)$/);
      const riderId = match ? Number(match[1]) : NaN;

      if (!isNaN(riderId)) {
        const r = await this.prisma.user.findUnique(({
          where: { id: riderId },
          select: { riderAvailability: true },
        } as any));
        if ((r as any)?.riderAvailability === 'AVAILABLE') base += 20;
      }
    } catch {}

    return Math.min(100, base);
  }
  
  // ----------------------------------------------------------
  // ADMIN OVERRIDES (E4.3)
  // ----------------------------------------------------------

  async adminForceCancel(orderId: number, reason?: string, adminId?: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.CANCELED) return order;

    const riderIdBefore = order.riderId;

    const { order: updated, changed } = await this.transitionStatus({
      orderId,
      actor: { id: Number(adminId) || 0, role: UserRole.ADMIN },
      to: OrderStatus.CANCELED,
      event: 'ADMIN_FORCE_CANCEL',
      data: { reason },
      extraUpdate: { riderId: null },
    });

    if (!changed) return updated as any;

    if (riderIdBefore) {
      try {
        await this.riderPayments.applyCancellationPenaltyForOrder(
          orderId,
          riderIdBefore,
          reason,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Rider cancellation penalty failed for order ${orderId}: ${msg}`,
        );
      }
    }

    this.ws.notifyUser(order.customerId, 'order_canceled', {
      orderId,
      reason,
    });

    if (order.pharmacyId) {
      this.ws.notifyUser(order.pharmacyId, 'order_canceled', {
        orderId,
        reason,
      });
      this.ws.notifyUser(order.pharmacyId, 'order.canceled', {
        orderId,
        reason,
      });
    }

    if (typeof (this.ws as any).notifyAdmins === 'function') {
      (this.ws as any).notifyAdmins('admin_order_override', {
        orderId,
        action: 'CANCEL',
      });
    }
    
    return updated;
  }

  async adminForceStatus(
    orderId: number,
    status: OrderStatus,
    note?: string,
    adminId?: number,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const { order: updated, changed } = await this.lifecycle.forceStatus({
      orderId,
      actor: { id: Number(adminId) || 0, role: UserRole.ADMIN },
      to: status,
      event: 'ADMIN_FORCE_STATUS',
      data: { to: status, note },
    } as any);

    if (!changed) return updated as any;

    this.ws.notifyUser(order.customerId, 'order_status_update', {
      orderId,
      status,
    });

    if (order.pharmacyId) {
      this.ws.notifyUser(order.pharmacyId, 'order_status_update', {
        orderId,
        status,
      });
      this.ws.notifyUser(order.pharmacyId, 'order.updated', {
        orderId,
        status,
      });
    }

    return updated;
  }

  async adminCompleteDelivery(
    orderId: number,
    adminId: number,
    opts?: { note?: string; proofUrl?: string; signatureUrl?: string; otp?: string },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status === OrderStatus.DELIVERED) return { ok: true, order };
    if (order.status === OrderStatus.CANCELED || order.status === OrderStatus.REJECTED) {
      throw new BadRequestException(`Cannot deliver order in status ${order.status}`);
    }

    const now = new Date();
    const extraUpdate: any = { deliveredAt: now };

    const proofUrl = opts?.proofUrl != null ? String(opts.proofUrl).trim() : '';
    const signatureUrl =
      opts?.signatureUrl != null ? String(opts.signatureUrl).trim() : '';
    const otp = opts?.otp != null ? String(opts.otp).trim() : '';

    if (proofUrl) {
      if (proofUrl.length > 1000) throw new BadRequestException('proofUrl too long');
      if (!/^https?:\/\//i.test(proofUrl)) {
        throw new BadRequestException('proofUrl must be a valid URL');
      }
      extraUpdate.deliveryProofUrl = proofUrl;
    }
    if (signatureUrl) {
      if (signatureUrl.length > 1000)
        throw new BadRequestException('signatureUrl too long');
      extraUpdate.deliverySignatureUrl = signatureUrl;
    }
    if (otp) {
      if (otp.length > 20) throw new BadRequestException('otp too long');
      extraUpdate.deliveryOtp = otp;
    }

    const { order: updated, changed } = await this.transitionStatus({
      orderId,
      actor: { id: Number(adminId) || 0, role: UserRole.ADMIN },
      to: OrderStatus.DELIVERED,
      event: 'ADMIN_MARK_DELIVERED',
      data: {
        adminId,
        note: opts?.note,
        proofUrl: extraUpdate.deliveryProofUrl ?? null,
        signatureUrl: extraUpdate.deliverySignatureUrl ?? null,
        otpProvided: extraUpdate.deliveryOtp ? true : false,
        fromStatus: order.status,
      },
      extraUpdate,
    });

    if (changed && order.riderId) {
      await this.prisma.user.update(({
        where: { id: order.riderId },
        data: { riderAvailability: 'AVAILABLE' },
      } as any));

      try {
        await this.riderPayments.ensureDeliveryEarningForOrder(orderId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Rider earning create failed for order ${orderId}: ${msg}`);
      }

      try {
        await this.geoSurge.removePoint(`order:${orderId}`);
      } catch {}
    }

    this.notify.create(
      order.customerId,
      'ORDER_DELIVERED',
      `Order #${orderId} delivered (admin override).`,
      { orderId },
      adminId,
    );

    if (order.pharmacyId) {
      this.notify.create(
        order.pharmacyId,
        'ORDER_DELIVERED',
        `Order #${orderId} delivered (admin override).`,
        { orderId },
        adminId,
      );
      this.ws.notifyUser(order.pharmacyId, 'order.updated', {
        orderId,
        status: OrderStatus.DELIVERED,
      });
    }

    if (order.riderId) {
      this.ws.notifyUser(order.riderId, 'order.updated', {
        orderId,
        status: OrderStatus.DELIVERED,
      });
    }

    this.ws.notifyUser(order.customerId, 'order_status_update', {
      orderId,
      stage: OrderStatus.DELIVERED,
    });

    if (typeof (this.ws as any).notifyAdmins === 'function') {
      (this.ws as any).notifyAdmins('admin_order_override', {
        orderId,
        action: 'DELIVERED',
      });
    }

    return { ok: true, order: updated };
  }

  async adminEscalateSla(
    orderId: number,
    adminId: number,
    opts?: { reason?: string; note?: string },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const reason = (opts?.reason ?? '').trim();
    const note = (opts?.note ?? '').trim();

    await this.logTimeline(orderId, 'ADMIN_SLA_ESCALATED', {
      adminId,
      reason: reason || undefined,
      note: note || undefined,
      status: order.status,
    });

    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: { id: true },
      take: 50,
    });

    await Promise.all(
      admins.map((a) =>
        this.notify.createDomainEvent(
          a.id,
          'order.sla_breached',
          `SLA escalated for order #${orderId}`,
          { orderId, reason: reason || undefined, note: note || undefined },
          adminId,
        ),
      ),
    );

    if (order.pharmacyId) {
      this.ws.notifyUser(order.pharmacyId, 'order.updated', {
        orderId,
        slaEscalated: true,
      });
    }

    return { ok: true };
  }

  // ----------------------------------------------------------
  // Customer confirm / reject pharmacy changes
  // ----------------------------------------------------------
  async customerConfirmChanges(customerId: number, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId)
      throw new BadRequestException('Not your order');

    if (order.status === OrderStatus.ACCEPTED) return { order };

    if ((order.status as any) !== NEEDS_CONFIRMATION_STATUS) {
      throw new BadRequestException(
        `Order is not awaiting confirmation (status=${order.status})`,
      );
    }

    const { order: updated, changed } = await this.transitionStatus({
      orderId,
      actor: { id: customerId, role: UserRole.CUSTOMER },
      from: NEEDS_CONFIRMATION_STATUS as any,
      to: OrderStatus.ACCEPTED,
      event: 'CUSTOMER_CONFIRMED_CHANGES',
      data: { customerId },
    });

    if (!changed) return { order: updated };

    this.notify.create(
      customerId,
      'ORDER_CONFIRMED',
      `You confirmed changes for order #${orderId}`,
      { orderId },
      customerId,
    );

    this.ws.notifyUser(customerId, 'order_status_update', {
      orderId,
      stage: OrderStatus.ACCEPTED,
    });

    if (order.pharmacyId) {
      this.notify.create(
        order.pharmacyId,
        'ORDER_CONFIRMED',
        `Customer confirmed changes for order #${orderId}`,
        { orderId },
        customerId,
      );
      this.ws.notifyUser(order.pharmacyId, 'order.updated', {
        orderId,
        status: OrderStatus.ACCEPTED,
      });
    }

    // Minimal pay-after-accept: request payment now that confirmation is done.
    if (order.paymentMode === PaymentMode.PAY_AFTER_ACCEPT) {
      await this.requestCustomerPayment({
        id: orderId,
        customerId,
        pharmacyId: order.pharmacyId,
        status: OrderStatus.ACCEPTED,
        paymentMode: order.paymentMode,
        paymentStatus: (updated as any).paymentStatus,
      } as any);
    }

    return { order: updated };
  }

  async customerRejectChanges(
    customerId: number,
    orderId: number,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId)
      throw new BadRequestException('Not your order');

    if (order.status === OrderStatus.CANCELED) return { order };

    if ((order.status as any) !== NEEDS_CONFIRMATION_STATUS) {
      throw new BadRequestException(
        `Order is not awaiting confirmation (status=${order.status})`,
      );
    }

    const { order: updated, changed } = await this.transitionStatus({
      orderId,
      actor: { id: customerId, role: UserRole.CUSTOMER },
      from: NEEDS_CONFIRMATION_STATUS as any,
      to: OrderStatus.CANCELED,
      event: 'CUSTOMER_REJECTED_CHANGES',
      data: { customerId, reason },
      extraUpdate: { riderId: null },
    });

    if (!changed) return { order: updated };

    if (order.riderId) {
      try {
        await this.riderPayments.applyCancellationPenaltyForOrder(
          orderId,
          order.riderId,
          reason || 'CUSTOMER_REJECTED_CHANGES',
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Rider cancellation penalty failed for order ${orderId}: ${msg}`,
        );
      }
    }

    this.ws.notifyUser(customerId, 'order_canceled', {
      orderId,
      reason: reason || 'Customer rejected pharmacy changes',
    });

    if (order.pharmacyId) {
      this.notify.create(
        order.pharmacyId,
        'ORDER_CANCELED',
        `Order #${orderId} canceled by customer (changes rejected)`,
        { orderId, reason },
        customerId,
      );
      this.ws.notifyUser(order.pharmacyId, 'order.canceled', {
        orderId,
        reason: reason || 'Customer rejected pharmacy changes',
      });
    }

    return { order: updated };
  }

  async customerCancelPending(
    customerId: number,
    orderId: number,
    reason?: string,
  ) {
    const order: any = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: ({
        id: true,
        customerId: true,
        pharmacyId: true,
        riderId: true,
        status: true,
        paymentStatus: true,
      } as any),
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId)
      throw new BadRequestException('Not your order');

    if (order.status === OrderStatus.CANCELED) return { order };

    const st = String(order.status || '').toUpperCase();
    if (st !== String(OrderStatus.PENDING)) {
      throw new BadRequestException(
        `Only pending orders can be canceled (status=${order.status})`,
      );
    }

    const ps = String(order.paymentStatus || 'UNPAID').toUpperCase();
    if (ps === 'PAID') {
      throw new BadRequestException('Cannot cancel a paid order');
    }

    const { order: updated, changed } = await this.transitionStatus({
      orderId,
      actor: { id: customerId, role: UserRole.CUSTOMER },
      from: OrderStatus.PENDING,
      to: OrderStatus.CANCELED,
      event: 'CUSTOMER_CANCELED',
      data: { customerId, reason },
      extraUpdate: { riderId: null },
    });

    if (!changed) return { order: updated };

    this.notify.create(
      customerId,
      'ORDER_CANCELED',
      `Order #${orderId} canceled`,
      { orderId, reason },
      customerId,
    );

    this.ws.notifyUser(customerId, 'order_status_update', {
      orderId,
      stage: OrderStatus.CANCELED,
    });

    if (order.pharmacyId) {
      this.notify.create(
        order.pharmacyId,
        'ORDER_CANCELED',
        `Order #${orderId} canceled by customer`,
        { orderId, reason },
        customerId,
      );
      this.ws.notifyUser(order.pharmacyId, 'order.canceled', {
        orderId,
        reason: reason || 'Customer canceled order',
      });
    }

    return { order: updated };
  }

  async adminUnassignRider(orderId: number, adminId?: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (!order.riderId) return order;

    await this.prisma.user.update(({
      where: { id: order.riderId },
      data: { riderAvailability: 'AVAILABLE' },
    } as any));

    const { order: updated } = await this.lifecycle.forceStatus({
      orderId,
      actor: { id: Number(adminId) || 0, role: UserRole.ADMIN },
      to: OrderStatus.ASSIGNED,
      event: 'ADMIN_UNASSIGNED_RIDER',
      data: { riderId: order.riderId },
      extraUpdate: { riderId: null },
    } as any);
    if (order.pharmacyId) {
      this.ws.notifyUser(order.pharmacyId, 'order.updated', {
        orderId,
        status: OrderStatus.ASSIGNED,
        riderId: null,
      });
    }

    return updated;
  }

  async adminAddNote(orderId: number, note: string) {
    await this.logTimeline(orderId, 'ADMIN_NOTE', { note });
    return { ok: true };
  }

  // ----------------------------------------------------------
  // SETTLEMENT (ADMIN)
  // ----------------------------------------------------------
  private async getSettlementState(orderId: number): Promise<{
    settled: boolean;
    lastEvent?: string;
    at?: Date;
    data?: any;
  }> {
    const last = await this.prisma.orderTimeline.findFirst({
      where: {
        orderId,
        event: { in: ['ADMIN_SETTLED_ORDER', 'ADMIN_UNSETTLED_ORDER'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!last) return { settled: false };
    return {
      settled: last.event === 'ADMIN_SETTLED_ORDER',
      lastEvent: last.event,
      at: last.createdAt,
      data: last.data ? JSON.parse(last.data) : undefined,
    };
  }

  async adminSettleOrder(
    orderId: number,
    adminId: number,
    opts?: { note?: string; force?: boolean },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const force = Boolean(opts?.force);
    if (!force) {
      const ok =
        order.status === OrderStatus.DELIVERED ||
        order.status === OrderStatus.PAID;
      if (!ok) {
        throw new BadRequestException(
          `Order cannot be settled until delivered/paid (status=${order.status}). Use force=true to override.`,
        );
      }
    }

    const current = await this.getSettlementState(orderId);
    if (current.settled) {
      return {
        ok: true,
        orderId,
        settled: true,
        already: true,
        settledAt: current.at ?? null,
      };
    }

    const note = (opts?.note ?? '').trim();

    await this.logTimeline(orderId, 'ADMIN_SETTLED_ORDER', {
      adminId,
      note: note || undefined,
      force,
      orderStatus: order.status,
    });

    if (order.pharmacyId) {
      this.notify.create(
        order.pharmacyId,
        'ORDER_SETTLED',
        `Order #${orderId} settled`,
        { orderId },
        adminId,
      );
      this.ws.notifyUser(order.pharmacyId, 'order.updated', {
        orderId,
        settled: true,
      });
    }

    return { ok: true, orderId, settled: true };
  }

  async adminUnsettleOrder(
    orderId: number,
    adminId: number,
    opts?: { note?: string },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const current = await this.getSettlementState(orderId);
    if (!current.settled && current.lastEvent === 'ADMIN_UNSETTLED_ORDER') {
      return { ok: true, orderId, settled: false, already: true };
    }

    const note = (opts?.note ?? '').trim();

    await this.logTimeline(orderId, 'ADMIN_UNSETTLED_ORDER', {
      adminId,
      note: note || undefined,
      orderStatus: order.status,
    });

    if (order.pharmacyId) {
      this.notify.create(
        order.pharmacyId,
        'ORDER_UNSETTLED',
        `Order #${orderId} marked as unsettled`,
        { orderId },
        adminId,
      );
      this.ws.notifyUser(order.pharmacyId, 'order.updated', {
        orderId,
        settled: false,
      });
    }

    return { ok: true, orderId, settled: false };
  }
}
