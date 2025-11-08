// src/queues/redis.decorators.ts
import { Inject } from '@nestjs/common';
export const InjectRedis = () => Inject('REDIS');
