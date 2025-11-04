import { Controller, Get } from '@nestjs/common';

@Controller('admin')
export class AdminController {
  @Get('status')
  getStatus() {
    return { message: '✅ Admin API active', timestamp: new Date().toISOString() };
  }
}
