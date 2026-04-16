import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { getRedisOptions } from './connection.js';
const QUEUE_NAME = 'commissionQueue';
let commissionQueue = null;
export function getCommissionQueue() {
    if (!env.bullmqEnabled)
        return null;
    if (!commissionQueue) {
        commissionQueue = new Queue(QUEUE_NAME, { connection: getRedisOptions() });
    }
    return commissionQueue;
}
