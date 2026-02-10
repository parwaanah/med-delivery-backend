import {
  Controller,
  Get,
  Query,
  Res,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { MedicinesService } from './medicines.service';
import { Response } from 'express';

@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('query') queryAlt: string,
    @Res() res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');

    const query = (q || queryAlt || '').trim();

    if (!query) {
      const items = await this.medicinesService.getFeaturedMedicines();
      return res.json({ items });
    }

    if (query.length < 2) {
      return res.json({ items: [] });
    }

    const items = await this.medicinesService.searchMedicines(query);
    return res.json({ items });
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const medicine = await this.medicinesService.getMedicineById(Number(id));

    if (!medicine) {
      throw new NotFoundException('Medicine not found');
    }

    return medicine;
  }

  @Get(':id/substitutes')
  async substitutes(@Param('id') id: string) {
    const medicineId = Number(id);
    if (!Number.isFinite(medicineId)) {
      throw new NotFoundException('Medicine not found');
    }
    const items = await this.medicinesService.getSubstitutesByMedicineId(medicineId);
    return { items };
  }
}
