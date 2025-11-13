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
} from '@nestjs/common';
import { RidersService } from './riders.service';
import {
  CreateRiderDto,
  UpdateRiderDto,
  UpdateStatusDto,
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

  @Patch(':id/location')
  @Roles('rider', 'admin')
  async updateLocation(
    @Param('id') id: string,
    @Body() body: { lat: number; lon: number },
  ) {
    return this.ridersService.updateLocation(Number(id), body.lat, body.lon);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.ridersService.remove(Number(id));
  }
}
