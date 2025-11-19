// src/riders/riders.controller.ts
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
  BadRequestException,
} from '@nestjs/common';
import { RidersService } from './riders.service';
import {
  CreateRiderDto,
  UpdateRiderDto,
  UpdateStatusDto,
  UpdateLocationDto,
} from './dto/rider.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('riders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Get()
  @Roles('admin')
  findAll() {
    return this.ridersService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'rider')
  findOne(@Param('id') id: string) {
    return this.ridersService.findOne(Number(id));
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateRiderDto) {
    return this.ridersService.create(dto);
  }

  @Put(':id')
  @Roles('admin', 'rider')
  update(@Param('id') id: string, @Body() dto: UpdateRiderDto) {
    return this.ridersService.update(Number(id), dto);
  }

  @Patch(':id/status')
  @Roles('admin', 'rider')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.ridersService.updateStatus(Number(id), dto);
  }

  /**
   * Update live location.
   * Accepts either:
   *   { "latitude": 19.0, "longitude": 72.0 }
   * or
   *   { "lat": 19.0, "lon": 72.0 }
   *
   * Normalizes incoming fields and passes numeric values to service.
   */
  @Patch(':id/location')
  @Roles('rider', 'admin')
  async updateLocation(
    @Param('id') id: string,
    @Body() body: UpdateLocationDto,
  ) {
    // normalize numeric values (prefer canonical names, fall back to short)
    const lat = typeof body.latitude === 'number' ? body.latitude : body.lat;
    const lon =
      typeof body.longitude === 'number' ? body.longitude : body.lon;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new BadRequestException(
        'latitude and longitude (or lat and lon) are required and must be numbers',
      );
    }

    return this.ridersService.updateLocation(Number(id), lat, lon);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.ridersService.remove(Number(id));
  }
}
