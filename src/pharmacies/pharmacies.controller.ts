// pharmacies/pharmacies.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { PharmaciesService } from './pharmacies.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('pharmacies')
export class PharmaciesController {
  constructor(private readonly pharmaciesService: PharmaciesService) {}

  // Anyone with JWT can view pharmacies
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.pharmaciesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pharmaciesService.findOne(+id);
  }

  // Admin-only: create a new pharmacy
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req: any, @Body() body: { name: string; address: string; phone: string }) {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admins only');
    return this.pharmaciesService.create(body);
  }

  // Admin-only: add medicine to pharmacy
  @UseGuards(JwtAuthGuard)
  @Post(':id/medicine')
  addMedicine(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { name: string; description?: string; price: number; stock: number },
  ) {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admins only');
    return this.pharmaciesService.addMedicine(+id, body);
  }
}
