import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return { message: '🚀 Backend is running fine!' };
  }

  // ✅ Simple test endpoint for throttling
  @Get('throttle-test')
  throttleTest() {
    return {
      success: true,
      message: 'This is a throttle test endpoint 🚦',
      timestamp: new Date().toISOString(),
    };
  }
}
