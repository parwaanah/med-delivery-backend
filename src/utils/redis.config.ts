import { ConfigService } from '@nestjs/config';

export function getRedisUrl(config: ConfigService): string {
  return 'redis://redis:6379'; // 🔥 Hard force
}
