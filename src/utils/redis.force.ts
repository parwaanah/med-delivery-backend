// FORCE REDIS URL FOR ENTIRE APP (Workers / Services / Legacy Code)

import { ConfigService } from '@nestjs/config';

export function forceRedisUrl(config: ConfigService): string {
  const dockerUrl = 'redis://redis:6379';

  // always override anything else
  return dockerUrl;
}
