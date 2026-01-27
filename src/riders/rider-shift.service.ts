import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { RedisService } from '../utils/redis.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';

type ShiftState = 'ACTIVE' | 'IDLE';
type AvailabilityState = 'ONLINE' | 'OFFLINE';

@Injectable()
export class RiderShiftService {
  private readonly logger = new Logger(RiderShiftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notify: NotificationService,
    private readonly ws: WsGateway,
  ) {}

  private availabilityKey(riderId: number) {
    return `rider:availability:${riderId}`;
  }

  private heartbeatKey(riderId: number) {
    return `rider:heartbeat:${riderId}`;
  }

  private shiftKey(riderId: number) {
    return `rider:shift:current:${riderId}`;
  }

  private onlineSetKey() {
    return `rider:online:set`;
  }

  private idleSinceKey(riderId: number) {
    return `rider:idle_since:${riderId}`;
  }

  private ttlSec() {
    const n = Number(process.env.RIDER_AVAILABILITY_TTL_SEC || 300);
    if (!Number.isFinite(n)) return 300;
    return Math.min(Math.max(Math.floor(n), 30), 3600);
  }

  async setAvailabilityCache(riderId: number, state: AvailabilityState) {
    const ttl = this.ttlSec();
    await this.redis.client.set(this.availabilityKey(riderId), state, { EX: ttl });
    if (state === 'ONLINE') {
      await this.redis.client.sAdd(this.onlineSetKey(), String(riderId));
    } else {
      await this.redis.client.sRem(this.onlineSetKey(), String(riderId));
    }
  }

  async heartbeat(riderId: number) {
    const ttl = this.ttlSec();
    await this.redis.client.set(this.heartbeatKey(riderId), String(Date.now()), {
      EX: ttl,
    });
    // keep ONLINE TTL fresh if rider is online
    const cur = await this.redis.client.get(this.availabilityKey(riderId));
    if (cur === 'ONLINE') {
      await this.redis.client.set(this.availabilityKey(riderId), 'ONLINE', {
        EX: ttl,
      });
    }

    const currentShiftId = await this.redis.client.get(this.shiftKey(riderId));
    if (currentShiftId) {
      await (this.prisma as any).riderShiftSession.update({
        where: { id: Number(currentShiftId) },
        data: { lastHeartbeat: new Date() },
      });
    }
  }

  private async getCurrentShiftId(riderId: number): Promise<number | null> {
    const cached = await this.redis.client.get(this.shiftKey(riderId));
    if (cached && Number.isFinite(Number(cached))) return Number(cached);

    const row = await (this.prisma as any).riderShiftSession.findFirst({
      where: { riderId, endTime: null },
      orderBy: { startTime: 'desc' },
      select: { id: true },
    });
    if (!row) return null;

    await this.redis.client.set(this.shiftKey(riderId), String(row.id), {
      EX: this.ttlSec(),
    });
    return Number(row.id);
  }

  private computeDeltaSec(from: Date | string, to: Date) {
    const fromMs = new Date(from as any).getTime();
    const toMs = to.getTime();
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
    return Math.max(0, Math.floor((toMs - fromMs) / 1000));
  }

  async transitionShiftState(
    riderId: number,
    newState: ShiftState,
    now = new Date(),
  ) {
    const id = await this.getCurrentShiftId(riderId);
    if (!id) return;

    const current = await (this.prisma as any).riderShiftSession.findUnique({
      where: { id },
      select: { lastState: true, lastStateAt: true, activeSec: true, idleSec: true },
    });
    if (!current) return;

    const delta = this.computeDeltaSec(current.lastStateAt, now);
    const data: any = {
      lastState: newState,
      lastStateAt: now,
      lastHeartbeat: now,
    };
    if (String(current.lastState).toUpperCase() === 'ACTIVE') {
      data.activeSec = Number(current.activeSec || 0) + delta;
    } else {
      data.idleSec = Number(current.idleSec || 0) + delta;
    }

    await (this.prisma as any).riderShiftSession.update({
      where: { id },
      data,
    });

    // For offer scoring: track when rider became idle/available while ONLINE.
    try {
      if (newState === 'IDLE') {
        await this.redis.client.set(this.idleSinceKey(riderId), String(now.getTime()), {
          EX: this.ttlSec(),
        });
      } else {
        await this.redis.client.del(this.idleSinceKey(riderId));
      }
    } catch {}
  }

  async startShift(riderId: number) {
    const open = await (this.prisma as any).riderShiftSession.findFirst({
      where: { riderId, endTime: null },
      orderBy: { startTime: 'desc' },
    });
    if (open) {
      await this.redis.client.set(this.shiftKey(riderId), String(open.id), {
        EX: this.ttlSec(),
      });
      await this.setAvailabilityCache(riderId, 'ONLINE');
      await this.heartbeat(riderId);
      return open;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: riderId },
      select: { id: true, role: true, status: true, riderAvailability: true } as any,
    });
    if (!user || String(user.role).toUpperCase() !== 'RIDER') {
      throw new BadRequestException('Rider not found');
    }
    const status = String(user.status).toUpperCase();
    if (status !== 'ACTIVE' && status !== 'APPROVED') {
      throw new BadRequestException('Rider must be ACTIVE to start shift');
    }

    const now = new Date();
    const startState: ShiftState =
      String((user as any).riderAvailability).toUpperCase() === 'BUSY'
        ? 'ACTIVE'
        : 'IDLE';

    if (status === 'APPROVED') {
      await this.prisma.user.update(({
        where: { id: riderId },
        data: { status: 'ACTIVE', riderAvailability: 'AVAILABLE' },
      } as any));
    }

    const created = await (this.prisma as any).riderShiftSession.create({
      data: {
        riderId,
        startTime: now,
        lastState: startState,
        lastStateAt: now,
        lastHeartbeat: now,
      },
    });

    // Default to ONLINE/AVAILABLE when shift starts.
    await this.prisma.user.update(({
      where: { id: riderId },
      data: { riderAvailability: 'AVAILABLE' },
    } as any));

    await this.redis.client.set(this.shiftKey(riderId), String(created.id), {
      EX: this.ttlSec(),
    });
    await this.setAvailabilityCache(riderId, 'ONLINE');
    await this.heartbeat(riderId);

    // Initialize idle timer for scoring when shift starts in IDLE state.
    try {
      if (startState === 'IDLE') {
        await this.redis.client.set(this.idleSinceKey(riderId), String(now.getTime()), {
          EX: this.ttlSec(),
        });
      } else {
        await this.redis.client.del(this.idleSinceKey(riderId));
      }
    } catch {}

    this.ws.notifyUser(riderId, 'rider.availability', { state: 'ONLINE' });
    return created;
  }

  async endShift(riderId: number, reason?: string) {
    const id = await this.getCurrentShiftId(riderId);
    if (!id) {
      await this.setAvailabilityCache(riderId, 'OFFLINE');
      return { ok: true, ended: false };
    }

    const now = new Date();
    const cur = await (this.prisma as any).riderShiftSession.findUnique({
      where: { id },
      select: {
        startTime: true,
        lastState: true,
        lastStateAt: true,
        activeSec: true,
        idleSec: true,
      },
    });
    if (!cur) return { ok: true, ended: false };

    const delta = this.computeDeltaSec(cur.lastStateAt, now);
    let activeSec = Number(cur.activeSec || 0);
    let idleSec = Number(cur.idleSec || 0);
    if (String(cur.lastState).toUpperCase() === 'ACTIVE') activeSec += delta;
    else idleSec += delta;

    const durationSec = this.computeDeltaSec(cur.startTime, now);

    await (this.prisma as any).riderShiftSession.update({
      where: { id },
      data: {
        endTime: now,
        durationSec,
        activeSec,
        idleSec,
        endedReason: reason || null,
      },
    });

    await this.prisma.user.update(({
      where: { id: riderId },
      data: { riderAvailability: 'OFFLINE' },
    } as any));

    await this.setAvailabilityCache(riderId, 'OFFLINE');
    await this.redis.client.del(this.shiftKey(riderId));
    await this.redis.client.del(this.heartbeatKey(riderId));
    await this.redis.client.del(this.idleSinceKey(riderId));

    this.ws.notifyUser(riderId, 'rider.availability', { state: 'OFFLINE', reason });

    return { ok: true, ended: true, durationSec, activeSec, idleSec };
  }

  async getIdleSinceMs(riderId: number): Promise<number | null> {
    const v = await this.redis.client.get(this.idleSinceKey(riderId));
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  }

  async setAvailability(riderId: number, state: AvailabilityState) {
    if (state === 'ONLINE') {
      const shift = await this.startShift(riderId);
      return { ok: true, state: 'ONLINE', shiftId: shift.id };
    }
    const ended = await this.endShift(riderId, 'MANUAL_OFFLINE');
    return { state: 'OFFLINE', ...ended };
  }

  async currentShift(riderId: number) {
    const id = await this.getCurrentShiftId(riderId);
    if (!id) return { active: false };
    const row = await (this.prisma as any).riderShiftSession.findUnique({
      where: { id },
    });
    if (!row) return { active: false };

    const now = new Date();
    const lastStateAt = row.lastStateAt ? new Date(row.lastStateAt) : now;
    const deltaSec = this.computeDeltaSec(lastStateAt, now);
    const baseActive = Number(row.activeSec || 0);
    const baseIdle = Number(row.idleSec || 0);
    const isActive = String(row.lastState || '').toUpperCase() === 'ACTIVE';

    const activeSecLive = isActive ? baseActive + deltaSec : baseActive;
    const idleSecLive = isActive ? baseIdle : baseIdle + deltaSec;
    const durationSecLive = this.computeDeltaSec(row.startTime, now);

    return {
      active: true,
      session: {
        ...row,
        activeSec: activeSecLive,
        idleSec: idleSecLive,
        durationSec: durationSecLive,
      },
    };
  }

  async autoTimeout(riderId: number, minutes: number) {
    const ended = await this.endShift(riderId, 'AUTO_TIMEOUT');
    await this.notify.create(
      riderId,
      'RIDER_INACTIVITY_TIMEOUT',
      `You were set OFFLINE due to ${minutes} minutes of inactivity`,
      { minutes },
    );
    return ended;
  }

  async getOnlineRiders() {
    try {
      return await this.redis.client.sMembers(this.onlineSetKey());
    } catch {
      return [];
    }
  }

  async getLastHeartbeatMs(riderId: number): Promise<number | null> {
    const v = await this.redis.client.get(this.heartbeatKey(riderId));
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  }
}
