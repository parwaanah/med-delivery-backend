// src/ws/admin.audit.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../utils/prisma.service';

@WebSocketGateway({ namespace: '/admin-audit', cors: { origin: '*' } })
@Injectable()
export class AdminAuditGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('AdminAuditGateway');

  @WebSocketServer() server!: Server;

  constructor(private prisma: PrismaService) {
    this.logger.log('✅ AdminAuditGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`🟢 Admin connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔴 Admin disconnected: ${client.id}`);
  }

  /**
   * Broadcasts a real-time audit event to all admin clients.
   */
  async broadcastAuditEvent(event: string, payload: any) {
    this.logger.debug(`📡 Emitting audit event: ${event}`);
    this.server.emit('audit_event', { event, payload });
  }

  /**
   * Used internally by AuditService to notify admins of login activity.
   */
  async notifyLoginActivity(data: {
    userId?: number;
    email?: string;
    ip?: string;
    userAgent?: string;
    eventType: string;
    success: boolean;
    role?: string;
  }) {
    this.server.emit('login_audit', data);
  }
}
