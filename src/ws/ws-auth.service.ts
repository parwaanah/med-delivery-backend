import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../utils/prisma.service';
import type { Socket } from 'socket.io';

export type WsAuthedUser = {
  id: number;
  role: string;
  status?: string | null;
};

function readCookie(rawCookieHeader: unknown, name: string): string | null {
  const header = typeof rawCookieHeader === 'string' ? rawCookieHeader : '';
  if (!header) return null;
  const parts = header.split(';');
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=');
    if (!k) continue;
    if (k === name) {
      const v = rest.join('=');
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return null;
}

@Injectable()
export class WsAuthService {
  private readonly logger = new Logger(WsAuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async authenticate(client: Socket): Promise<WsAuthedUser | null> {
    const token = this.extractToken(client);
    if (!token) return null;

    try {
      const payload: any = this.jwt.verify(token);
      const userId = Number(payload?.sub);
      if (!Number.isFinite(userId)) return null;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true },
      });
      if (!user) return null;

      return {
        id: user.id,
        role: String(user.role),
        status: (user as any).status ?? null,
      };
    } catch (err) {
      this.logger.debug(`WS auth failed: ${(err as any)?.message ?? err}`);
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake as any)?.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const header = String(
      (client.handshake.headers as any)?.authorization ?? '',
    ).trim();
    if (header.toLowerCase().startsWith('bearer ')) {
      const t = header.slice('bearer '.length).trim();
      return t || null;
    }

    // Cookie fallback (optional cookie-mode auth)
    const cookieHeader = (client.handshake.headers as any)?.cookie;
    const c = readCookie(cookieHeader, 'uskery_auth');
    if (c && c.trim()) return c.trim();

    return null;
  }
}
