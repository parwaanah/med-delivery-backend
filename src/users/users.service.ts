import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { AuditService } from '../utils/audit.service';
import { UpdateMedicalProfileDto } from './dto/update-medical-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique(({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        mfaEnabled: true,
        riderAvailability: true,
        riderReasonCode: true,
        riderReasonNote: true,
      },
    } as any));
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id },
      data: { name: dto.name, email: dto.email, role: dto.role },
    });
  }

  async updateMe(id: number, dto: UpdateMeDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const data: any = {};
    if (typeof dto.name === 'string') data.name = dto.name;
    if (typeof dto.phone === 'string') data.phone = dto.phone;
    if (typeof dto.latitude === 'number') data.latitude = dto.latitude;
    if (typeof dto.longitude === 'number') data.longitude = dto.longitude;

    // Cast select to `any` to remain compatible with older generated Prisma clients.
    return this.prisma.user.update(({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        mfaEnabled: true,
        riderAvailability: true,
        riderReasonCode: true,
        riderReasonNote: true,
        latitude: true,
        longitude: true,
      },
    } as any));
  }

  async remove(id: number) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted' };
  }

  async exportMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const medicalProfile = await this.prisma.medicalProfile.findUnique({
      where: { userId },
    });

    const addresses = await this.prisma.userAddress.findMany({
      where: { userId },
    });

    const orders = await this.prisma.order.findMany({
      where: {
        OR: [{ customerId: userId }, { pharmacyId: userId }, { riderId: userId }],
      },
      include: {
        items: true,
        offers: true,
        timeline: true,
        refundRequests: true,
      },
    });

    const notifications = await this.prisma.notification.findMany({
      where: { OR: [{ receiverId: userId }, { senderId: userId }] },
    });

    const supportTickets = await this.prisma.supportTicket.findMany({
      where: { requesterId: userId },
      include: { messages: true },
    });

    const verificationDocuments = await this.prisma.verificationDocument.findMany({
      where: { userId },
    });

    const loginAudit = await this.prisma.loginAudit.findMany({
      where: { userId },
    });

    const sessions = await this.prisma.session.findMany({
      where: { userId },
      include: { refreshTokens: true },
    });

    const riderData = await this.prisma.riderShiftSession.findMany({
      where: { riderId: userId },
    });

    const riderRatings = await this.prisma.riderRating.findMany({
      where: { riderId: userId },
    });

    const riderStrikes = await this.prisma.riderStrike.findMany({
      where: { riderId: userId },
    });

    return {
      exportedAt: new Date().toISOString(),
      user,
      medicalProfile,
      addresses,
      orders,
      notifications,
      supportTickets,
      verificationDocuments,
      loginAudit,
      sessions,
      rider: {
        shiftSessions: riderData,
        ratings: riderRatings,
        strikes: riderStrikes,
      },
    };
  }

  async getMedicalProfile(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const profile = await this.prisma.medicalProfile.findUnique({
      where: { userId },
      select: { allergies: true, conditions: true, notes: true, updatedAt: true },
    });

    return (
      profile ?? {
        allergies: [],
        conditions: [],
        notes: null,
        updatedAt: null,
      }
    );
  }

  async upsertMedicalProfile(userId: number, dto: UpdateMedicalProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const normalizeList = (v: unknown) =>
      Array.isArray(v)
        ? v
            .map((x) => String(x ?? '').trim())
            .filter(Boolean)
            .slice(0, 50)
        : undefined;

    const allergies = normalizeList(dto.allergies);
    const conditions = normalizeList(dto.conditions);
    const notes = typeof dto.notes === 'string' ? dto.notes.trim() : undefined;

    return this.prisma.medicalProfile.upsert({
      where: { userId },
      create: {
        userId,
        allergies: allergies ?? [],
        conditions: conditions ?? [],
        notes: notes ?? null,
      },
      update: {
        ...(allergies ? { allergies } : {}),
        ...(conditions ? { conditions } : {}),
        ...(typeof notes !== 'undefined' ? { notes } : {}),
      },
      select: { allergies: true, conditions: true, notes: true, updatedAt: true },
    });
  }

  async deleteMe(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const deletedEmail = user.email
      ? `deleted+${userId}@deleted.local`
      : null;
    const deletedPhone = user.phone ? `deleted-${userId}` : null;

    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.session.deleteMany({ where: { userId } }),
      this.prisma.userAddress.deleteMany({ where: { userId } }),
      this.prisma.medicalProfile.deleteMany({ where: { userId } }),
      this.prisma.notification.deleteMany({
        where: { OR: [{ receiverId: userId }, { senderId: userId }] },
      }),
      this.prisma.supportMessage.deleteMany({ where: { senderId: userId } }),
      this.prisma.supportTicket.deleteMany({ where: { requesterId: userId } }),
      this.prisma.loginAudit.deleteMany({ where: { userId } }),
      this.prisma.verificationDocument.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          email: deletedEmail,
          phone: deletedPhone,
          name: `Deleted User ${userId}`,
          password: null,
          googleId: null,
          otpCode: null,
          otpExpiresAt: null,
          mfaEnabled: false,
          mfaSecret: null,
          mfaTempSecret: null,
          mfaRecoveryCodes: [],
          emailVerified: false,
          phoneVerified: false,
          status: 'DELETED',
          riderAvailability: 'OFFLINE',
        },
      }),
    ]);

    await this.audit.logAdminAction({
      userId,
      action: 'USER_DATA_DELETE',
      resource: 'USER',
      meta: { userId, deletedAt: new Date().toISOString() },
    });

    return { message: 'User data deleted' };
  }
}
