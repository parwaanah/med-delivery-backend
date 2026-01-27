import { IsIn, IsOptional, IsInt, Min } from 'class-validator';

export class AdminUpdateTicketDto {
  @IsOptional()
  @IsIn(['OPEN', 'PENDING_ADMIN', 'PENDING_USER', 'RESOLVED', 'CLOSED'])
  status?: 'OPEN' | 'PENDING_ADMIN' | 'PENDING_USER' | 'RESOLVED' | 'CLOSED';

  @IsOptional()
  @IsInt()
  @Min(1)
  assignedAdminId?: number;
}
