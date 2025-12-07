import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class JwtBlacklistService {
  private redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
  private prefix = 'jwt_blacklist:';

  async revoke(token: string, exp: number) {
    const ttl = exp - Math.floor(Date.now() / 1000);
    await this.redis.setex(`${this.prefix}${token}`, ttl, 'revoked');
  }

  async isRevoked(token: string) {
    return (await this.redis.exists(`${this.prefix}${token}`)) === 1;
  }
}
