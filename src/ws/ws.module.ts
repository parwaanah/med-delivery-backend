// src/ws/ws.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { WsGateway } from './ws.gateway';
import { AuditLiveGateway } from './audit-live.gateway';
import { SurgeLiveGateway } from './surge-live.gateway';
import { RiderLiveGateway } from './rider-live.gateway';
import { ChatLiveGateway } from './chat-live.gateway';
import { GeoSurgeLiveGateway } from './geo-surge-live.gateway';

// Import ChatModule and RidersModule (use forwardRef to avoid circular import)
import { ChatModule } from '../chat/chat.module';
import { RidersModule } from '../riders/riders.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ChatModule),   // ChatService used by ChatLiveGateway
    forwardRef(() => RidersModule), // RidersService used by RiderLiveGateway
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'supersecret',
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') || '1h' },
      }),
    }),
  ],
  providers: [
    WsGateway,
    AuditLiveGateway,
    SurgeLiveGateway,
    RiderLiveGateway,
    ChatLiveGateway,
    GeoSurgeLiveGateway,
  ],
  exports: [
    WsGateway,
    AuditLiveGateway,
    SurgeLiveGateway,
    RiderLiveGateway,
    ChatLiveGateway,
    GeoSurgeLiveGateway,
  ],
})
export class WsModule {}
