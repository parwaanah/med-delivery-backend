import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ✅ Admin: View all orders
  @Get()
  @Roles('admin')
  async getAllOrders() {
    return this.ordersService.getOrders();
  }

  // ✅ Customer: Create new order (direct or broadcast)
  @Post()
  @Roles('customer')
  async createOrder(
    @Request() req,
    @Body()
    body: {
      pharmacyId?: number | null;
      items: { medicineId: number; quantity: number }[];
      customerLat?: number;
      customerLng?: number;
    },
  ) {
    const userId = req.user?.sub;
    const { pharmacyId = null, items, customerLat, customerLng } = body;

    if (!userId) throw new BadRequestException('User not authenticated');
    if (!Array.isArray(items) || items.length === 0)
      throw new BadRequestException('At least one valid item is required');

    return this.ordersService.createOrder(
      userId,
      pharmacyId,
      items,
      customerLat,
      customerLng,
    );
  }

  // ✅ Pharmacy: Accept or reject order (broadcast mode)
  @Patch(':id/pharmacy-response')
  @Roles('pharmacy')
  async pharmacyRespond(
    @Param('id') id: string,
    @Body() body: { pharmacyId: number; decision: 'accept' | 'reject' },
  ) {
    const orderId = Number(id);
    const { pharmacyId, decision } = body;

    if (!orderId || !pharmacyId)
      throw new BadRequestException('Order ID and Pharmacy ID are required');
    if (!['accept', 'reject'].includes(decision))
      throw new BadRequestException('Decision must be accept or reject');

    return this.ordersService.pharmacyRespond(orderId, pharmacyId, decision);
  }

  // ✅ Rider: Accept or reject a notified order
  @Patch(':id/rider-response')
  @Roles('rider')
  async riderRespond(
    @Param('id') id: string,
    @Body() body: { riderId: number; decision: 'accept' | 'reject' },
  ) {
    const orderId = Number(id);
    const { riderId, decision } = body;

    if (!orderId || !riderId)
      throw new BadRequestException('Order ID and Rider ID are required');
    if (!['accept', 'reject'].includes(decision))
      throw new BadRequestException('Decision must be accept or reject');

    return this.ordersService.riderRespond(orderId, riderId, decision);
  }

  // ✅ Admin: Manually assign rider (fallback or manual override)
  @Patch(':id/assign')
  @Roles('admin')
  async assignRider(
    @Param('id') id: string,
    @Body() body: { riderId: number },
  ) {
    const orderId = Number(id);
    const { riderId } = body;

    if (!orderId || !riderId)
      throw new BadRequestException('Order ID and Rider ID are required');

    const updated = await this.ordersService.assignRider(orderId, riderId);
    if (!updated) throw new NotFoundException('Order not found');
    return updated;
  }

  // ✅ Admin or Rider: Update order status
  @Patch(':id/status')
  @Roles('admin', 'rider')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    const orderId = Number(id);
    const { status } = body;

    if (!orderId) throw new BadRequestException('Invalid order ID');
    if (!status) throw new BadRequestException('Status is required');

    const updated = await this.ordersService.updateOrderStatus(orderId, status);
    if (!updated) throw new NotFoundException('Order not found');
    return updated;
  }

  // ✅ Rider: View orders assigned to them
  @Get('rider/:id')
  @Roles('rider')
  async getOrdersByRider(@Param('id') id: string) {
    const riderId = Number(id);
    if (!riderId) throw new BadRequestException('Invalid rider ID');

    const orders = await this.ordersService.getOrdersByRider(riderId);
    if (!orders || orders.length === 0)
      throw new NotFoundException('No orders found for this rider');

    return orders;
  }
}
