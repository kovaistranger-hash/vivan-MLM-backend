import { env } from '../config/env.js';
/** BullMQ / ioredis options (separate connections are created per Queue / Worker). */
export function getRedisOptions() {
    return {
        host: env.redisHost,
        port: env.redisPort,
        maxRetriesPerRequest: null
    };
}
