import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import { getRedisOptions } from './connection.js';
import { processDeliveredOrderCommissions } from '../modules/mlm/commission.service.js';
import { runDailyBinary } from '../modules/mlm/cron.service.js';
const QUEUE_NAME = 'commissionQueue';
let worker = null;
export function startCommissionWorker() {
    if (!env.bullmqEnabled || worker)
        return;
    worker = new Worker(QUEUE_NAME, async (job) => {
        if (job.name === 'runBinary') {
            await runDailyBinary();
            return;
        }
        if (job.name === 'processCommission') {
            const orderId = Number(job.data?.orderId);
            if (!Number.isFinite(orderId) || orderId <= 0)
                throw new Error('Invalid orderId');
            await processDeliveredOrderCommissions(orderId);
            return;
        }
        throw new Error(`Unknown job: ${job.name}`);
    }, { connection: getRedisOptions() });
    worker.on('failed', (job, err) => {
        console.error('[commission-worker] failed', job?.name, job?.id, err);
    });
    worker.on('completed', (job) => {
        console.log('[commission-worker] completed', job.name, job.id);
    });
    console.log('[commission-worker] listening on queue', QUEUE_NAME);
}
