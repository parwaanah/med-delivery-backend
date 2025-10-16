// medicines/medicines.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MedicinesService } from './medicines.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  // Authenticated users can get medicines
  @UseGuards(JwtAuthGuard)
  @Get()
  async getMedicines(@Query('pharmacyId') pharmacyId?: string) {
    if (pharmacyId) {
      return this.medicinesService.getMedicinesByPharmacy(Number(pharmacyId));
    }
    return this.medicinesService.getAllMedicines();
  }
}
