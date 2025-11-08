// src/pharmacies/pharmacy-inventory.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('pharmacies/inventory')
@Roles('ADMIN', 'PHARMACY')
export class PharmacyInventoryController {
  constructor(private readonly svc: PharmacyInventoryService) {}

  @Get(':pharmacyId/:medicineId/price')
  async getPrice(
    @Param('pharmacyId') pharmacyId: string,
    @Param('medicineId') medicineId: string,
    @Query('demand') _demand?: string,
  ) {
    // Phase 3 predictive model calculates surge internally, demand factor not required
    return this.svc.calculatePrice(Number(pharmacyId), Number(medicineId));
  }

  @Get(':pharmacyId')
  async getInventory(@Param('pharmacyId') pharmacyId: string) {
    return this.svc.listInventory(Number(pharmacyId));
  }
}
