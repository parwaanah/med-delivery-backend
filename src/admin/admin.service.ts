import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminService {
  getAdminStats() {
    return { uptime: process.uptime(), message: 'Admin Service Running' };
  }
}
