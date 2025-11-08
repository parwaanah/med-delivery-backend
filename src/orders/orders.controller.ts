import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
  Get,
  Patch,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RespondOfferDto } from './dto/respond-offer.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles('customer')
  create(@Req() req: any, @Body() dto: CreateOrderDto) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    return this.ordersService.createOrder(userId, dto);
  }

  @Get()
  findAll(@Req() req: any) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    const role = (req.user?.role ?? '').toUpperCase();
    return this.ordersService.findByUser(userId, role);
  }

  @Post('pharmacy/:orderId/respond')
  @Roles('pharmacy')
  pharmacyRespond(@Req() req: any, @Param('orderId') orderId: string, @Body() dto: RespondOfferDto) {
    const pharmacyId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    return this.ordersService.pharmacyRespond(pharmacyId, Number(orderId), dto.action);
  }

  @Post('rider/:orderId/respond')
  @Roles('rider')
  riderRespond(@Req() req: any, @Param('orderId') orderId: string, @Body() dto: RespondOfferDto) {
    const riderId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    return this.ordersService.riderRespond(riderId, Number(orderId), dto.action);
  }

  @Patch('rider/:orderId/stage')
  @Roles('rider')
  riderStage(@Req() req: any, @Param('orderId') orderId: string, @Body() body: { stage: 'REACHED_PHARMACY' | 'PICKED_UP' | 'DELIVERED'; location?: any }) {
    const riderId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    return this.ordersService.updateStage(riderId, Number(orderId), body.stage, body.location);
  }

  @Post('admin/:orderId/assign/:riderId')
  @Roles('admin')
  adminAssign(@Req() req: any, @Param('orderId') orderId: string, @Param('riderId') riderId: string) {
    const adminId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    return this.ordersService.adminAssign(Number(orderId), adminId, Number(riderId));
  }
}
