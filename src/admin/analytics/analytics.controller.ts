import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  async getSummary() {
    return await this.analyticsService.getSummary();
  }

  @Get('orders-trend')
  async getOrderTrends() {
    return await this.analyticsService.getOrderTrends();
  }

  @Get('top-pharmacies')
  async getTopPharmacies() {
    return await this.analyticsService.getTopPharmacies();
  }
}
