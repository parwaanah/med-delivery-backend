import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../utils/prisma.service";

function readCookie(rawCookieHeader: unknown, name: string): string | null {
  const header = typeof rawCookieHeader === 'string' ? rawCookieHeader : '';
  if (!header) return null;
  const parts = header.split(';');
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=');
    if (!k) continue;
    if (k === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return rest.join('=');
      }
    }
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // PRIMARY: Authorization header
        ExtractJwt.fromAuthHeaderAsBearerToken(),

        // FALLBACK: Cookie (optional, backward compatible)
        (req: any) => req?.cookies?.uskery_auth ?? readCookie(req?.headers?.cookie, 'uskery_auth'),
      ]),
      secretOrKey: process.env.JWT_SECRET || "dev-secret",
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    return user ?? null;
  }
}
