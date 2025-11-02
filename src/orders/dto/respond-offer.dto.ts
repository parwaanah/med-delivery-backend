// src/orders/dto/respond-offer.dto.ts
import { IsIn } from 'class-validator';

export class RespondOfferDto {
  @IsIn(['ACCEPTED','REJECTED'])
  action!: 'ACCEPTED' | 'REJECTED';
}
