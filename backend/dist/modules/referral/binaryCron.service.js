import { processBinaryPayout } from './binary.service.js';
/**
 * Daily binary payout job (IST calendar day idempotency inside {@link processBinaryPayout}).
 * Scheduled from `server.ts`; uses keyset batches to limit memory and query payload size.
 */
export async function runDailyBinary() {
    const batchSize = Number(process.env.BINARY_CRON_BATCH_SIZE || 1000);
    const summary = await processBinaryPayout({ batchSize });
    return summary;
}
