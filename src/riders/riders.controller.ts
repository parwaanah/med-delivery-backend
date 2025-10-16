// src/riders/riders.controller.ts
import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards } from '@nestjs/common';
import { RidersService } from './riders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('riders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  // ✅ Create rider (admin only)
  @Post()
  @Roles('admin')
  async createRider(
    @Body() body: { name: string; phone: string; vehicleNumber: string; password?: string },
  ) {
    const { name, phone, vehicleNumber, password } = body;
    return this.ridersService.createRider(name, phone, vehicleNumber, password);
  }

  // ✅ Get all riders (admin only)
  @Get()
  @Roles('admin')
  async getAllRiders() {
    return this.ridersService.getAllRiders();
  }

  // ✅ Update rider
  @Patch(':id')
  @Roles('admin')
  async updateRider(@Param('id') id: string, @Body() data: any) {
    return this.ridersService.updateRider(Number(id), data);
  }

  // ✅ Delete rider
  @Delete(':id')
  @Roles('admin')
  async deleteRider(@Param('id') id: string) {
    return this.ridersService.deleteRider(Number(id));
  }
}
