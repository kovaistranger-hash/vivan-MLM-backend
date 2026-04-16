import { getPayoutOptimizerSnapshot } from './optimizer.service.js';
import { processBinaryPayout, type ProcessBinaryPayoutSummary } from './binary.service.js';
import { logger } from '../../utils/logger.js';

const EMPTY_SUMMARY: ProcessBinaryPayoutSummary = {
  eligible: 0,
  paid: 0,
  skippedAlreadyToday: 0,
  skippedNoRoomOrZero: 0,
  errors: 0,
  skippedSettings: false
};

/**
 * Daily binary payout for **all** eligible users: company payout-ratio guard, then batched
 * {@link processBinaryPayout} (keyset scan, idempotent per user per IST day, caps, TDS/admin, ledger).
 */
export async function runBinaryDaily(): Promise<ProcessBinaryPayoutSummary> {
  logger.info('Running binary daily cron');

  const danger = Number(process.env.COMPANY_PAYOUT_RATIO_DANGER ?? 0.7);
  const snap = await getPayoutOptimizerSnapshot();
  if (snap.payoutRatio != null && snap.payoutRatio > danger) {
    logger.warn('Binary cron: company payout ratio above danger threshold', {
      payoutRatio: snap.payoutRatio,
      dangerThreshold: danger
    });
    if (['1', 'true', 'yes'].includes(String(process.env.BINARY_CRON_SKIP_WHEN_PAYOUT_OVER_70 || '').toLowerCase())) {
      return { ...EMPTY_SUMMARY };
    }
  }

  const batchSize = Number(process.env.BINARY_CRON_BATCH_SIZE || 1000);
  return processBinaryPayout({ batchSize });
}

/** Alias for workers / dispatch (`runBinary` job). */
export async function runDailyBinary() {
  return runBinaryDaily();
}
