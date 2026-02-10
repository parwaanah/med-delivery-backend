import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Post('track')
  track(@Req() req: Request, @Body() body: any) {
    const user = (req as any).user;
    const userId = user?.id ?? body?.userId ?? null;

    this.analytics.track({
      name: body?.name,
      userId,
      sessionId: body?.sessionId ?? null,
      props: body?.props ?? {},
      ts: body?.ts,
    });

    return { ok: true };
  }
}

