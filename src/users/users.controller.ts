import {
  Controller,
  Get,
  Param,
  Put,
  Delete,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  /**
   * ✅ CURRENT AUTHENTICATED USER
   * Used by frontend for session hydration
   */
  @Get('me')
  getMe(@Req() req: Request) {
    const user = req.user as { id: number };

    if (!user?.id) {
      throw new Error('Authenticated user missing id');
    }

    return this.usersService.findOne(user.id);
  }

  /**
   * ✅ ADMIN — LIST ALL USERS
   */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * ✅ GET USER BY ID
   */
  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.PHARMACY,
    UserRole.RIDER,
    UserRole.CUSTOMER,
  )
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(Number(id));
  }

  /**
   * ✅ ADMIN — UPDATE USER
   */
  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(Number(id), dto);
  }

  /**
   * ✅ ADMIN — DELETE USER
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(Number(id));
  }
}
