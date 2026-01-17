import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Patch,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { PharmaciesService } from './pharmacies.service';
import {
  CreatePharmacyDto,
  UpdatePharmacyDto,
} from './dto/pharmacy.dto';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import { UserRole } from '@prisma/client';

@Controller('pharmacies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PharmaciesController {
  constructor(private readonly pharmaciesService: PharmaciesService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.pharmaciesService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PHARMACY)
  findOne(@Param('id') id: string) {
    return this.pharmaciesService.findOne(Number(id));
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreatePharmacyDto) {
    return this.pharmaciesService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.PHARMACY)
  update(@Param('id') id: string, @Body() dto: UpdatePharmacyDto) {
    return this.pharmaciesService.update(Number(id), dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.pharmaciesService.remove(Number(id));
  }

  // ----------------------------------------------------
  // ✅ Update pharmacy location
  // ----------------------------------------------------
  @Patch(':id/location')
  @Roles(UserRole.ADMIN, UserRole.PHARMACY)
  async updateLocation(
    @Param('id') id: string,
    @Body('lat') lat: number,
    @Body('lon') lon: number,
  ) {
    if (!lat || !lon) {
      throw new HttpException(
        'lat & lon required',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.pharmaciesService.updateLocation(Number(id), lat, lon);
  }
}
