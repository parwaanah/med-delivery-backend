// src/riders/riders.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { RidersService } from './riders.service';

@Controller('riders')
export class RidersController {
  constructor(private riders: RidersService) {}

  @Patch(':id/location')
  async updateLocation(
    @Param('id') id: string,
    @Body() body: { lat: number; lon: number },
  ) {
    if (!body.lat || !body.lon)
      throw new BadRequestException('lat & lon required');

    return this.riders.updateLocation(Number(id), body.lat, body.lon);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'AVAILABLE' | 'BUSY' | 'OFFLINE' },
  ) {
    return this.riders.updateStatus(Number(id), body.status);
  }
}
