import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const strictEnv =
  isProduction || ['1', 'true', 'yes'].includes(String(process.env.STRICT_ENV || '').toLowerCase());

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value == null || String(value).trim() === '') {
    throw new Error(`Missing env var: ${name}`);
  }
  return String(value).trim();
}

/** Required when `NODE_ENV=production` or `STRICT_ENV=true` (no dev defaults). */
function requiredStrict(name: string, devFallback?: string): string {
  if (strictEnv) {
    return required(name);
  }
  return required(name, devFallback);
}

const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
if (!jwtAccessSecret || !jwtRefreshSecret) {
  throw new Error('Missing JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (or legacy JWT_SECRET for both)');
}

const MIN_JWT_SECRET_LEN = 24;
if (strictEnv) {
  if (jwtAccessSecret.length < MIN_JWT_SECRET_LEN || jwtRefreshSecret.length < MIN_JWT_SECRET_LEN) {
    throw new Error(
      `JWT secrets must be at least ${MIN_JWT_SECRET_LEN} characters when NODE_ENV=production or STRICT_ENV is set`
    );
  }
}

const bullmqEnabled = ['1', 'true', 'yes'].includes(String(process.env.BULLMQ_ENABLED || '').toLowerCase());

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv,
  isProduction,
  /** True when production or STRICT_ENV — stricter URL / JWT / optional Redis rules apply. */
  strictEnv,
  appUrl: requiredStrict('APP_URL', 'http://localhost:5000'),
  frontendUrl: requiredStrict('FRONTEND_URL', 'http://localhost:5173'),
  dbHost: required('DB_HOST'),
  dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: required('DB_USER'),
  dbPassword: required('DB_PASSWORD'),
  dbName: required('DB_NAME'),
  jwtAccessSecret,
  jwtRefreshSecret,
  jwtAccessExpiresIn: required('JWT_ACCESS_EXPIRES_IN', '15m'),
  jwtRefreshExpiresIn: required('JWT_REFRESH_EXPIRES_IN', '30d'),
  uploadDir: required('UPLOAD_DIR', 'uploads'),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  /** RazorpayX / Payouts (optional). When unset, withdrawal mark-paid still records `payouts` with reference `manual:{id}`. */
  razorpayPayoutKeyId: process.env.RAZORPAY_PAYOUT_KEY_ID || process.env.RAZORPAYX_KEY_ID || '',
  razorpayPayoutKeySecret: process.env.RAZORPAY_PAYOUT_KEY_SECRET || process.env.RAZORPAYX_KEY_SECRET || '',
  razorpayPayoutFundAccountId: process.env.RAZORPAY_PAYOUT_FUND_ACCOUNT_ID || '',
  razorpayPayoutSourceAccountNumber: process.env.RAZORPAY_PAYOUT_SOURCE_ACCOUNT_NUMBER || '',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  /** When true, order commissions + daily binary are dispatched via BullMQ (requires Redis). */
  bullmqEnabled,
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: Number(process.env.REDIS_PORT || 6379),
  /**
   * When true and payout ratio exceeds the danger threshold, `risk.service` may clamp
   * `compensation_settings.binary_percentage` (and mirrored leg %) downward (see risk engine).
   */
  riskAutoMitigate: ['1', 'true', 'yes'].includes(String(process.env.RISK_AUTO_MITIGATE || '').toLowerCase()),
  /**
   * When true, binary match % uses a dynamic rate from `mlm/optimizer.service` (payout ratio + signup growth),
   * capped between 5% and 12% and never above `compensation_settings.binary_percentage`.
   */
  payoutOptimizerEnabled: ['1', 'true', 'yes'].includes(
    String(process.env.PAYOUT_OPTIMIZER_ENABLED || '').toLowerCase()
  ),
  /** When false, high fraud scores log but do not set `wallets.is_locked`. */
  fraudAutoFreeze: !['0', 'false', 'no'].includes(String(process.env.FRAUD_AUTO_FREEZE || '').toLowerCase()),
  /** Withdrawals at or above this INR require verified KYC (even if admin toggle is off). */
  kycHighWithdrawalInr: Math.max(0, Number(process.env.KYC_HIGH_WITHDRAWAL_INR || 25_000)),
  /** L2 (Aadhaar + selfie) required at or above this INR. */
  kycTier2WithdrawalInr: Math.max(0, Number(process.env.KYC_TIER2_WITHDRAWAL_INR || 50_000)),
  /** Block withdrawals when `user_scores.score` is below this threshold. */
  scoringMinWithdrawScore: Math.min(100, Math.max(0, Number(process.env.SCORING_MIN_WITHDRAW_SCORE || 20))),
  /** Recompute `user_scores` when older than this many hours. */
  scoringCacheTtlMs: Math.max(60_000, Number(process.env.SCORING_CACHE_HOURS || 24) * 3_600_000),
  /** Optional Expo push API token (Expo account → Access tokens) for server-side notifications. */
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || ''
};

if (!Number.isFinite(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

if (!Number.isFinite(env.dbPort) || env.dbPort < 1 || env.dbPort > 65535) {
  throw new Error(`Invalid DB_PORT: ${process.env.DB_PORT}`);
}
