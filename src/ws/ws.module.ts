// src/ws/ws.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { WsGateway } from './ws.gateway';
import { AuditLiveGateway } from './audit-live.gateway';
import { SurgeLiveGateway } from './surge-live.gateway';
import { RiderLiveGateway } from './rider-live.gateway';
import { ChatLiveGateway } from './chat-live.gateway';
import { GeoSurgeLiveGateway } from './geo-surge-live.gateway';

import { ChatModule } from '../chat/chat.module'; // ✅ FIX: Import ChatModule for ChatService

@Module({
  imports: [
    ConfigModule,
    ChatModule, // ✅ ChatService now available inside WsModule
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'supersecret',
        signOptions: { expiresIn: '1h' },
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
