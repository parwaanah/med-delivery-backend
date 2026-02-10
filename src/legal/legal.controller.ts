import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LegalService } from './legal.service';

@Controller('legal')
export class LegalController {
  constructor(private legal: LegalService) {}

  @Get('config')
  getConfig() {
    return this.legal.getConfig();
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(@Req() req: any) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    const cfg = this.legal.getConfig();
    const status = await this.legal.hasAccepted(userId, cfg.version);
    return { ...cfg, ...status };
  }

  @UseGuards(JwtAuthGuard)
  @Post('accept')
  async accept(@Req() req: any, @Body() body: { version?: string }) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    const cfg = this.legal.getConfig();
    const version = String(body?.version || cfg.version).trim() || cfg.version;

    const ip =
      (req.headers && (req.headers['x-forwarded-for'] as string)) ||
      (req.ip as string) ||
      null;
    const userAgent = (req.headers && (req.headers['user-agent'] as string)) || null;

    const row = await this.legal.accept(userId, version, { ip, userAgent });
    return { ok: true, version: row.version, acceptedAt: row.acceptedAt };
  }
}

