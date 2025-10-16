import { IsIn, IsString } from 'class-validator';

export class UpdateStatusDto {
  @IsString()
  @IsIn(['pending', 'accepted', 'delivered', 'cancelled'])
  status: string;
}
