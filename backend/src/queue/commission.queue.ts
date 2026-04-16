import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { getRedisOptions } from './connection.js';

const QUEUE_NAME = 'commissionQueue';

let commissionQueue: Queue | null = null;

export function getCommissionQueue(): Queue | null {
  if (!env.bullmqEnabled) return null;
  if (!commissionQueue) {
    commissionQueue = new Queue(QUEUE_NAME, { connection: getRedisOptions() });
  }
  return commissionQueue;
}
