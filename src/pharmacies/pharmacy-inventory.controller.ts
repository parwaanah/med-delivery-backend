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
  ForbiddenException,
} from '@nestjs/common';

import { PharmacyInventoryService } from './pharmacy-inventory.service';

import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApprovalGuard } from '../common/guards/approval.guard';
import { PrismaService } from '../utils/prisma.service';
import { UserRole } from '@prisma/client';

@Controller('pharmacies')
@UseGuards(JwtAuthGuard, RolesGuard, ApprovalGuard)
export class PharmaciesInventoryController {
  constructor(private readonly svc: PharmacyInventoryService) {}

  @Post(':id/inventory/add')
  @Roles(UserRole.PHARMACY, UserRole.ADMIN)
  async addInventory(@Req() req: any, @Param('id') id: string, @Body() dto: CreateInventoryDto) {
    const pharmacyId = Number(id);

    if (req.user?.role === UserRole.PHARMACY && Number(req.user?.id) !== pharmacyId) {
      throw new NotFoundException('Not authorized to add inventory for this pharmacy');
    }

    return this.svc.add(pharmacyId, dto);
  }

  @Patch(':id/inventory/:invId')
  @Roles(UserRole.PHARMACY, UserRole.ADMIN)
  updateInventory(
    @Req() req: any,
    @Param('id') id: string,
    @Param('invId') invId: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    const pharmacyId = Number(id);

    if (req.user?.role === UserRole.PHARMACY && Number(req.user?.id) !== pharmacyId) {
      throw new NotFoundException('Not authorized');
    }

    return this.svc.update(Number(invId), dto);
  }

  @Delete(':id/inventory/:invId')
  @Roles(UserRole.PHARMACY, UserRole.ADMIN)
  removeInventory(@Req() req: any, @Param('id') id: string, @Param('invId') invId: string) {
    const pharmacyId = Number(id);

    if (req.user?.role === UserRole.PHARMACY && Number(req.user?.id) !== pharmacyId) {
      throw new NotFoundException('Not authorized');
    }

    return this.svc.remove(Number(invId));
  }

  @Get(':id/inventory')
  @Roles(UserRole.PHARMACY, UserRole.ADMIN)
  listInventory(@Param('id') id: string) {
    return this.svc.listInventory(Number(id));
  }
}

// -------------------------------------------------------------
// Pharmacy self-managed inventory
// -------------------------------------------------------------
@Controller('pharmacy/inventory')
@UseGuards(JwtAuthGuard, RolesGuard, ApprovalGuard)
@Roles(UserRole.PHARMACY)
export class PharmacyInventoryController {
  constructor(
    private readonly svc: PharmacyInventoryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@Req() req: any) {
    const pharmacyId = Number(req.user?.id);

    return this.prisma.pharmacyInventory.findMany(({
      where: { pharmacyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        medicine: {
          select: {
            id: true,
            name: true,
            rxType: true,
            category: true,
          },
        },
      },
    } as any));
  }

  @Post()
  async add(@Req() req: any, @Body() dto: CreateInventoryDto) {
    const pharmacyId = Number(req.user?.id);
    const created = await this.svc.add(pharmacyId, dto);

    return this.prisma.pharmacyInventory.findUnique({
      where: { id: created.id },
      include: {
        medicine: {
          select: { id: true, name: true, rxType: true, category: true },
        },
      },
    });
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    const pharmacyId = Number(req.user?.id);
    const inventoryId = Number(id);

    const rec: any = await this.prisma.pharmacyInventory.findUnique({
      where: { id: inventoryId },
      select: { id: true, pharmacyId: true },
    });

    if (!rec || rec.deletedAt) throw new NotFoundException('Inventory record not found');
    if (rec.pharmacyId !== pharmacyId) {
      throw new ForbiddenException('Not authorized');
    }

    await this.svc.update(inventoryId, dto);

    return this.prisma.pharmacyInventory.findUnique({
      where: { id: inventoryId },
      include: {
        medicine: {
          select: { id: true, name: true, rxType: true, category: true },
        },
      },
    });
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const pharmacyId = Number(req.user?.id);
    const inventoryId = Number(id);

    const rec: any = await this.prisma.pharmacyInventory.findUnique({
      where: { id: inventoryId },
      select: { id: true, pharmacyId: true },
    });

    if (!rec || rec.deletedAt) throw new NotFoundException('Inventory record not found');
    if (rec.pharmacyId !== pharmacyId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.svc.remove(inventoryId);
  }
}
