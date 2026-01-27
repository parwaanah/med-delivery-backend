import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { UserAddressesService } from './user-addresses.service';
import { UpsertAddressDto } from './dto/address.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@Controller('users/me/addresses')
export class UserAddressesController {
  constructor(private readonly addresses: UserAddressesService) {}

  @Get()
  list(@Req() req: any) {
    return this.addresses.list(Number(req.user?.id));
  }

  @Post()
  create(@Req() req: any, @Body() dto: UpsertAddressDto) {
    return this.addresses.create(Number(req.user?.id), dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<UpsertAddressDto>) {
    const addrId = Number(id);
    if (!Number.isFinite(addrId)) throw new BadRequestException('Invalid id');
    return this.addresses.update(Number(req.user?.id), addrId, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    const addrId = Number(id);
    if (!Number.isFinite(addrId)) throw new BadRequestException('Invalid id');
    return this.addresses.remove(Number(req.user?.id), addrId);
  }
}

