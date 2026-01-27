import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { ServiceAreaService } from './service-area.service';
import { UpsertZoneDto } from './dto/upsert-zone.dto';

@Controller('admin/zones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ServiceAreaAdminController {
  constructor(private readonly serviceArea: ServiceAreaService) {}

  @Get()
  list() {
    return this.serviceArea.listZones();
  }

  @Post()
  create(@Body() dto: UpsertZoneDto) {
    return this.serviceArea.createZone(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<UpsertZoneDto>) {
    return this.serviceArea.updateZone(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceArea.deleteZone(Number(id));
  }
}

