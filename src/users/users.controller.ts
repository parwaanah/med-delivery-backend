import {
  Controller,
  Get,
  Param,
  Put,
  Patch,
  Delete,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateMedicalProfileDto } from './dto/update-medical-profile.dto';
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
   * Update current authenticated user (safe subset)
   */
  @Patch('me')
  @Roles(
    UserRole.ADMIN,
    UserRole.PHARMACY,
    UserRole.RIDER,
    UserRole.CUSTOMER,
  )
  updateMe(@Req() req: Request, @Body() dto: UpdateMeDto) {
    const user = req.user as { id: number };
    return this.usersService.updateMe(user.id, dto);
  }

  /**
   * Export current user's data (privacy request)
   */
  @Get('me/export')
  @Roles(
    UserRole.ADMIN,
    UserRole.PHARMACY,
    UserRole.RIDER,
    UserRole.CUSTOMER,
  )
  exportMe(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.usersService.exportMe(user.id);
  }

  /**
   * Medical profile (allergies/conditions)
   */
  @Get('me/medical-profile')
  @Roles(
    UserRole.ADMIN,
    UserRole.PHARMACY,
    UserRole.RIDER,
    UserRole.CUSTOMER,
  )
  getMedicalProfile(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.usersService.getMedicalProfile(user.id);
  }

  @Put('me/medical-profile')
  @Roles(
    UserRole.ADMIN,
    UserRole.PHARMACY,
    UserRole.RIDER,
    UserRole.CUSTOMER,
  )
  upsertMedicalProfile(@Req() req: Request, @Body() dto: UpdateMedicalProfileDto) {
    const user = req.user as { id: number };
    return this.usersService.upsertMedicalProfile(user.id, dto);
  }

  @Patch('me/medical-profile')
  @Roles(
    UserRole.ADMIN,
    UserRole.PHARMACY,
    UserRole.RIDER,
    UserRole.CUSTOMER,
  )
  patchMedicalProfile(@Req() req: Request, @Body() dto: UpdateMedicalProfileDto) {
    const user = req.user as { id: number };
    return this.usersService.upsertMedicalProfile(user.id, dto);
  }

  /**
   * Delete (anonymize) current user's data
   */
  @Delete('me')
  @Roles(
    UserRole.ADMIN,
    UserRole.PHARMACY,
    UserRole.RIDER,
    UserRole.CUSTOMER,
  )
  deleteMe(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.usersService.deleteMe(user.id);
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
