// src/riders/riders.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RidersService } from './riders.service';
import { CreateRiderDto, UpdateRiderDto, UpdateStatusDto } from './dto/rider.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SurgeService } from '../surge/surge.service';

@Controller('riders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RidersController {
  constructor(
    private readonly ridersService: RidersService,
    private readonly surge: SurgeService,
  ) {}

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

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.ridersService.remove(Number(id));
  }

  @Patch(':id/status')
  @Roles('admin', 'rider')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    const result = await this.ridersService.updateStatus(Number(id), dto);

    try {
      const isAvailable = dto.status?.toUpperCase() === 'AVAILABLE';
      await this.surge.recordRiderAvailability(Number(id), isAvailable);
    } catch (err) {
      console.error('⚠️ Surge supply update failed:', err);
    }

    return result;
  }
}
