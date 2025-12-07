// backend/src/medicines/medicines.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { MedicinesService } from './medicines.service';

@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Get('search')
  async search(@Query('q') q: string) {
    const query = (q || '').trim();
    if (!query || query.length < 2) return [];

    return this.medicinesService.searchMedicines(query);
  }
}
