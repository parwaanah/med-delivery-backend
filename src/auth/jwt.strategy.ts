import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../utils/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // PRIMARY: Authorization header
        ExtractJwt.fromAuthHeaderAsBearerToken(),

        // FALLBACK: Cookie (optional, backward compatible)
        (req: any) => req?.cookies?.uskery_auth,
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
