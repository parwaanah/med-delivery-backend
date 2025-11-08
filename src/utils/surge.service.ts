// src/utils/surge.service.ts
import { Injectable } from '@nestjs/common';
import { addMinutes, isAfter } from 'date-fns';

@Injectable()
export class SurgeService {
  private surgeMultiplier = 1.0;
  private surgeUntil: Date | null = null;

  setSurge(multiplier: number, durationMinutes: number) {
    this.surgeMultiplier = multiplier;
    this.surgeUntil = addMinutes(new Date(), durationMinutes);
  }

  getCurrentMultiplier() {
    if (this.surgeUntil && isAfter(new Date(), this.surgeUntil)) {
      this.surgeMultiplier = 1.0;
      this.surgeUntil = null;
    }
    return this.surgeMultiplier;
  }

  isSurgeActive() {
    return this.surgeMultiplier > 1.0 && this.surgeUntil && isAfter(this.surgeUntil, new Date());
  }
}
