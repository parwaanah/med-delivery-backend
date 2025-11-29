// src/pharmacies/pharmacy-inventory.controller.ts
import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Get,
  Patch,
  Delete,
  NotFoundException,
} from '@nestjs/common';

import { PharmacyInventoryService } from './pharmacy-inventory.service';

import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('pharmacies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PharmaciesInventoryController {
  constructor(private readonly svc: PharmacyInventoryService) {}

  @Post(':id/inventory/add')
  @Roles('pharmacy', 'admin')
  async addInventory(@Req() req: any, @Param('id') id: string, @Body() dto: CreateInventoryDto) {
    const pharmacyId = Number(id);

    if ((req.user?.role ?? '').toUpperCase() === 'PHARMACY' && Number(req.user?.id) !== pharmacyId) {
      throw new NotFoundException('Not authorized to add inventory for this pharmacy');
    }

    return this.svc.add(pharmacyId, dto);
  }

  @Patch(':id/inventory/:invId')
  @Roles('pharmacy', 'admin')
  updateInventory(
    @Req() req: any,
    @Param('id') id: string,
    @Param('invId') invId: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    const pharmacyId = Number(id);

    if ((req.user?.role ?? '').toUpperCase() === 'PHARMACY' && Number(req.user?.id) !== pharmacyId) {
      throw new NotFoundException('Not authorized');
    }

    return this.svc.update(Number(invId), dto);
  }

  @Delete(':id/inventory/:invId')
  @Roles('pharmacy', 'admin')
  removeInventory(@Req() req: any, @Param('id') id: string, @Param('invId') invId: string) {
    const pharmacyId = Number(id);

    if ((req.user?.role ?? '').toUpperCase() === 'PHARMACY' && Number(req.user?.id) !== pharmacyId) {
      throw new NotFoundException('Not authorized');
    }

    return this.svc.remove(Number(invId));
  }

  @Get(':id/inventory')
  @Roles('pharmacy', 'admin')
  listInventory(@Param('id') id: string) {
    return this.svc.listInventory(Number(id));
  }
}
