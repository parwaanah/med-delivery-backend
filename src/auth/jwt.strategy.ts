// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback_secret_key', // ✅ add fallback
    } as any); // 👈 bypass strict typing issue
  }

  async validate(payload: any) {
    console.log('✅ JWT validated payload:', payload);
    if (!payload?.sub) return null;

    return { sub: payload.sub, email: payload.email, role: payload.role };
  }
}
