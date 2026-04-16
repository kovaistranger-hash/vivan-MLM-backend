import { getCommissionQueue } from './commission.queue.js';
import { processDeliveredOrderCommissions } from '../modules/mlm/commission.service.js';
import { runDailyBinary } from '../modules/mlm/cron.service.js';
/**
 * Enqueue commission processing or run inline when BullMQ is disabled.
 * Call **after** the order row is committed so the worker sees final `status`.
 */
export async function dispatchOrderCommissionJob(orderId) {
    const q = getCommissionQueue();
    if (!q) {
        await processDeliveredOrderCommissions(orderId);
        return { mode: 'inline' };
    }
    await q.add('processCommission', { orderId }, {
        attempts: 5,
        removeOnComplete: 1000,
        backoff: { type: 'exponential', delay: 3000 }
    });
    return { mode: 'queue' };
}
/** Daily binary: enqueue or run inline when BullMQ is off. */
export async function dispatchBinaryCronJob() {
    const q = getCommissionQueue();
    if (!q) {
        const summary = await runDailyBinary();
        return summary;
    }
    await q.add('runBinary', {}, { attempts: 2, removeOnComplete: 500, backoff: { type: 'fixed', delay: 5000 } });
    return { mode: 'queue' };
}
