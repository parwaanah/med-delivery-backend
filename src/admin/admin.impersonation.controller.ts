import {
  BadRequestException,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminPerms } from '../common/decorators/admin-perms.decorator';
import { AdminPermsGuard } from '../common/guards/admin-perms.guard';
import { UserRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';

@Controller('admin/impersonate')
@UseGuards(JwtAuthGuard, RolesGuard, AdminPermsGuard)
@Roles(UserRole.ADMIN)
@AdminPerms('SUPERADMIN', 'SECURITY')
export class AdminImpersonationController {
  constructor(private readonly auth: AuthService) {}

  @Post(':id')
  async impersonate(@Req() req: any, @Param('id') id: string) {
    const targetId = Number(id);
    if (!Number.isFinite(targetId)) {
      throw new BadRequestException('Invalid user id');
    }

    return this.auth.issueImpersonationToken(Number(req.user?.id), targetId);
  }
}
