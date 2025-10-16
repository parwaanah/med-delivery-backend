"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../admin/audit/audit.service");
const client_1 = require("@prisma/client");
let OrdersService = OrdersService_1 = class OrdersService {
    prisma;
    auditService;
    logger = new common_1.Logger(OrdersService_1.name);
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async createOrder(userId, pharmacyId, items, customerLat, customerLng) {
        if (!items?.length)
            throw new common_1.BadRequestException('At least one medicine is required');
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        if (pharmacyId) {
            this.logger.log(`🛍️ User #${userId} placed direct order to Pharmacy #${pharmacyId}`);
            return this.createDirectOrder(userId, pharmacyId, items);
        }
        this.logger.log(`📡 Broadcasting order from User #${userId} to nearby pharmacies`);
        return this.createBroadcastOrder(user, items, customerLat, customerLng);
    }
    async createDirectOrder(userId, pharmacyId, items) {
        const pharmacy = await this.prisma.pharmacy.findUnique({
            where: { id: pharmacyId },
            include: { medicines: true },
        });
        if (!pharmacy)
            throw new common_1.BadRequestException('Pharmacy not found');
        const orderItems = items.map((i) => {
            const med = pharmacy.medicines.find((m) => m.id === i.medicineId);
            if (!med)
                throw new common_1.BadRequestException(`Medicine ${i.medicineId} not found`);
            if (i.quantity > med.stock)
                throw new common_1.BadRequestException(`Insufficient stock for ${med.name}`);
            return { medicineId: med.id, quantity: i.quantity, price: med.price };
        });
        const order = await this.prisma.$transaction(async (tx) => {
            for (const item of orderItems) {
                await tx.medicine.update({
                    where: { id: item.medicineId },
                    data: { stock: { decrement: item.quantity } },
                });
            }
            return tx.order.create({
                data: {
                    userId,
                    pharmacyId,
                    status: client_1.OrderStatus.pending,
                    items: { create: orderItems },
                },
                include: { pharmacy: true, items: { include: { medicine: true } } },
            });
        });
        await this.logOrderEvent(order.id, 'Order Created', 'customer', userId);
        await this.auditService.record(userId, 'customer', 'Created Order', 'Order', order.id);
        this.logger.log(`✅ Order #${order.id} created for Pharmacy #${pharmacyId}`);
        await this.sendNotification('pharmacy', pharmacyId, {
            title: '🆕 New Order Received',
            message: `Order #${order.id} has been placed by a customer.`,
        });
        return order;
    }
    async createBroadcastOrder(user, items, customerLat, customerLng) {
        const pharmacies = await this.prisma.pharmacy.findMany({ include: { medicines: true } });
        const eligible = pharmacies.filter((p) => items.every((i) => {
            const m = p.medicines.find((x) => x.id === i.medicineId);
            return m && m.stock >= i.quantity;
        }));
        if (!eligible.length)
            throw new common_1.BadRequestException('No pharmacy has all requested medicines');
        const order = await this.prisma.order.create({
            data: {
                userId: user.id,
                status: client_1.OrderStatus.awaiting_pharmacy_acceptance,
                items: {
                    create: items.map((i) => ({
                        medicineId: i.medicineId,
                        quantity: i.quantity,
                        price: 0,
                    })),
                },
            },
        });
        await this.prisma.orderPharmacyRequest.createMany({
            data: eligible.map((p) => ({ orderId: order.id, pharmacyId: p.id })),
        });
        for (const p of eligible) {
            await this.sendNotification('pharmacy', p.id, {
                title: '📦 New Order Opportunity',
                message: `Order #${order.id} is waiting for acceptance.`,
            });
        }
        await this.logOrderEvent(order.id, 'Order Broadcasted', 'system', null, `${eligible.length} pharmacies pinged.`);
        await this.auditService.record(user.id, 'customer', 'Broadcasted Order', 'Order', order.id);
        this.logger.log(`📢 Broadcasted Order #${order.id} to ${eligible.length} pharmacies.`);
        return { message: 'Order broadcasted successfully', orderId: order.id };
    }
    async pharmacyRespond(orderId, pharmacyId, decision) {
        const req = await this.prisma.orderPharmacyRequest.findFirst({ where: { orderId, pharmacyId } });
        if (!req)
            throw new common_1.NotFoundException('Order request not found');
        await this.prisma.orderPharmacyRequest.update({
            where: { id: req.id },
            data: { status: decision === 'accept' ? 'accepted' : 'rejected' },
        });
        if (decision === 'reject') {
            await this.logOrderEvent(orderId, 'Pharmacy Rejected', 'pharmacy', pharmacyId);
            await this.auditService.record(pharmacyId, 'pharmacy', 'Rejected Order', 'Order', orderId);
            this.logger.log(`🚫 Pharmacy #${pharmacyId} rejected Order #${orderId}`);
            return { message: 'Order rejected' };
        }
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { pharmacyId, status: client_1.OrderStatus.accepted },
            include: { pharmacy: true },
        });
        await this.logOrderEvent(orderId, 'Pharmacy Accepted', 'pharmacy', pharmacyId);
        await this.auditService.record(pharmacyId, 'pharmacy', 'Accepted Order', 'Order', orderId);
        await this.notifyNearbyRiders(orderId, pharmacyId);
        return { message: 'Pharmacy accepted and riders notified', order: updated };
    }
    async riderRespond(orderId, riderId, decision) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const req = await this.prisma.orderRiderRequest.findFirst({
            where: { orderId, riderId },
        });
        if (!req)
            throw new common_1.NotFoundException('No pending request found for this rider');
        if (decision === 'reject') {
            await this.prisma.orderRiderRequest.update({
                where: { id: req.id },
                data: { status: 'rejected' },
            });
            await this.logOrderEvent(orderId, 'Rider Rejected', 'rider', riderId);
            await this.auditService.record(riderId, 'rider', 'Rejected Delivery', 'Order', orderId);
            this.logger.log(`🚫 Rider #${riderId} rejected Order #${orderId}`);
            return { message: 'Rider rejected order' };
        }
        const alreadyAccepted = await this.prisma.orderRiderRequest.findFirst({
            where: { orderId, status: 'accepted' },
        });
        if (alreadyAccepted) {
            await this.prisma.orderRiderRequest.update({
                where: { id: req.id },
                data: { status: 'expired' },
            });
            this.logger.log(`⌛ Rider #${riderId} tried to accept but order already taken.`);
            return { message: 'Order already accepted by another rider' };
        }
        await this.prisma.orderRiderRequest.update({
            where: { id: req.id },
            data: { status: 'accepted' },
        });
        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: { riderId, status: client_1.OrderStatus.pending },
            include: { pharmacy: true },
        });
        await this.prisma.orderRiderRequest.updateMany({
            where: { orderId, riderId: { not: riderId }, status: 'pending' },
            data: { status: 'expired' },
        });
        await this.logOrderEvent(orderId, 'Rider Accepted', 'rider', riderId);
        await this.auditService.record(riderId, 'rider', 'Accepted Delivery', 'Order', orderId);
        if (updatedOrder.pharmacyId) {
            await this.sendNotification('pharmacy', updatedOrder.pharmacyId, {
                title: '🚴 Rider Assigned',
                message: `Order #${orderId} is being picked up by a rider.`,
            });
        }
        this.logger.log(`✅ Rider #${riderId} accepted and assigned to Order #${orderId}`);
        return { message: 'Order assigned to this rider', order: updatedOrder };
    }
    async notifyNearbyRiders(orderId, pharmacyId) {
        const pharmacy = await this.prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
        if (!pharmacy?.latitude || !pharmacy?.longitude)
            return;
        const riders = await this.prisma.rider.findMany({ where: { isAvailable: true } });
        const nearby = riders
            .map((r) => ({
            rider: r,
            distance: this.getDistance(pharmacy.latitude, pharmacy.longitude, r.latitude ?? 0, r.longitude ?? 0),
        }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 10);
        await this.prisma.orderRiderRequest.createMany({
            data: nearby.map((r) => ({ orderId, riderId: r.rider.id })),
        });
        for (const r of nearby) {
            await this.sendNotification('rider', r.rider.id, {
                title: '🚚 New Delivery Available',
                message: `Order #${orderId} is nearby (${r.distance.toFixed(1)} km)`,
            });
        }
        await this.logOrderEvent(orderId, 'Riders Notified', 'system');
        this.logger.log(`📢 Notified ${nearby.length} riders for Order #${orderId}`);
    }
    getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) ** 2;
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }
    async logOrderEvent(orderId, action, actorType, actorId, details) {
        try {
            await this.prisma.orderLog.create({ data: { orderId, actorType, actorId: actorId ?? null, action, details } });
        }
        catch (err) {
            this.logger.error(`OrderLog failed: ${err?.message ?? err}`);
        }
    }
    async sendNotification(targetType, targetId, payload) {
        if (!targetId)
            return;
        this.logger.log(`🔔 Notification → ${targetType.toUpperCase()} #${targetId}\nTitle: ${payload.title}\nMessage: ${payload.message}`);
        try {
            await this.prisma.notification.create({
                data: {
                    targetType,
                    targetId,
                    title: payload.title,
                    message: payload.message,
                },
            });
        }
        catch (err) {
            this.logger.warn(`⚠️ Notification DB log failed for ${targetType} #${targetId}: ${err?.message ?? err}`);
        }
    }
    async getOrders() {
        return this.prisma.order.findMany({
            include: {
                user: true,
                pharmacy: true,
                rider: true,
                items: { include: { medicine: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async assignRider(orderId, riderId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const rider = await this.prisma.rider.findUnique({ where: { id: riderId } });
        if (!rider)
            throw new common_1.NotFoundException('Rider not found');
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { riderId },
            include: { rider: true },
        });
        await this.auditService.record(riderId, 'admin', 'Rider Manually Assigned', 'Order', orderId);
        await this.sendNotification('rider', riderId, {
            title: '🧭 Delivery Assigned',
            message: `Order #${orderId} was assigned to you by admin.`,
        });
        return updated;
    }
    async updateOrderStatus(orderId, status) {
        const valid = Object.values(client_1.OrderStatus);
        if (!valid.includes(status))
            throw new common_1.BadRequestException('Invalid status');
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { status: status },
            include: { pharmacy: true },
        });
        await this.auditService.record(null, 'system', `Status Updated → ${status}`, 'Order', orderId);
        await this.logOrderEvent(orderId, `Status → ${status}`, 'system');
        if (updated.pharmacyId) {
            await this.sendNotification('pharmacy', updated.pharmacyId, {
                title: '📦 Order Status Changed',
                message: `Order #${orderId} is now ${status.toUpperCase()}.`,
            });
        }
        return updated;
    }
    async getOrdersByRider(riderId) {
        const rider = await this.prisma.rider.findUnique({ where: { id: riderId } });
        if (!rider)
            throw new common_1.NotFoundException('Rider not found');
        return this.prisma.order.findMany({
            where: { riderId },
            include: { user: true, pharmacy: true, items: { include: { medicine: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map