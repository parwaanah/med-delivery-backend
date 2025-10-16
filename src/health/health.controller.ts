import { Controller, Get, InternalServerErrorException } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    try {
      return {
        status: '✅ OK',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Health check error:', error);
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
