import type { RedisOptions } from 'ioredis';
import { env } from '../config/env.js';

/** BullMQ / ioredis options (separate connections are created per Queue / Worker). */
export function getRedisOptions(): RedisOptions {
  return {
    host: env.redisHost,
    port: env.redisPort,
    maxRetriesPerRequest: null
  };
}
