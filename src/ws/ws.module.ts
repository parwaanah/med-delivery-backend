import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../utils/prisma.service';
import { WsGateway } from './ws.gateway';
import { AuditLiveGateway } from './audit-live.gateway';
import { RiderLiveGateway } from './rider-live.gateway';
import { SurgeLiveGateway } from './surge-live.gateway';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [
    PrismaService,
    WsGateway,
    AuditLiveGateway,
    RiderLiveGateway,
    SurgeLiveGateway,
  ],
  exports: [
    WsGateway,
    AuditLiveGateway,
    RiderLiveGateway,
    SurgeLiveGateway,
  ],
})
export class WsModule {}
