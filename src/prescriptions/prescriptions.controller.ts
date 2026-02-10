import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrescriptionsService } from './prescriptions.service';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class PrescriptionsController {
  constructor(private prescriptions: PrescriptionsService) {}

  @Get()
  list(@Req() req: any) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    return this.prescriptions.listForCustomer(userId);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    return this.prescriptions.getForCustomer(userId, Number(id));
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { url?: string },
  ) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    return this.prescriptions.updateForCustomer(userId, Number(id), {
      url: body?.url,
    });
  }
}
