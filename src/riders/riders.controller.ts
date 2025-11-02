import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { RidersService } from './riders.service';
import { CreateRiderDto, UpdateRiderDto, UpdateStatusDto } from './dto/rider.dto';
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

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.ridersService.remove(Number(id));
  }

  @Patch(':id/status')
  @Roles('admin', 'rider')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.ridersService.updateStatus(Number(id), dto);
  }
}
