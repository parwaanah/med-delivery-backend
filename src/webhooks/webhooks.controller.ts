// src/webhooks/webhooks.controller.ts
import { Controller, Post, Body, Headers } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Post('pharmacy')
  async pharmacyCallback(
    @Headers('x-api-key') key: string,
    @Body() payload: any,
  ) {
    return this.service.handlePharmacyCallback(key, payload);
  }

  @Post('rider')
  async riderCallback(@Headers('x-api-key') key: string, @Body() payload: any) {
    return this.service.handleRiderCallback(key, payload);
  }
}
