import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../utils/prisma.service';

@Injectable()
export class AppConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig(key: string) {
    return this.prisma.appConfig.findUnique({ where: { key } });
  }

  async setConfig(key: string, value: Prisma.InputJsonValue) {
    return this.prisma.appConfig.upsert({
      where: { key },
      // Prisma's Json input types can be fussy across client versions; cast to keep builds stable.
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });
  }
}
