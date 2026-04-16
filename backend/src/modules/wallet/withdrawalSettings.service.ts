import type { PoolConnection } from 'mysql2/promise';
import { pool, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';

const SETTINGS_ID = 1;

export type WithdrawalSettingsRow = {
  id: number;
  min_withdrawal_amount: number;
  max_withdrawal_amount: number | null;
  withdrawal_fee_type: 'fixed' | 'percentage';
  withdrawal_fee_value: number;
  kyc_required: number;
  auto_approve: number;
  allow_upi: number;
  allow_bank_transfer: number;
  one_pending_request_only: number;
  updated_at: Date;
  updated_by: number | null;
};

function mapRow(r: any): WithdrawalSettingsRow {
  return {
    id: Number(r.id),
    min_withdrawal_amount: Number(r.min_withdrawal_amount),
    max_withdrawal_amount: r.max_withdrawal_amount != null ? Number(r.max_withdrawal_amount) : null,
    withdrawal_fee_type: r.withdrawal_fee_type,
    withdrawal_fee_value: Number(r.withdrawal_fee_value),
    kyc_required: Number(r.kyc_required),
    auto_approve: Number(r.auto_approve),
    allow_upi: Number(r.allow_upi),
    allow_bank_transfer: Number(r.allow_bank_transfer),
    one_pending_request_only: Number(r.one_pending_request_only),
    updated_at: r.updated_at,
    updated_by: r.updated_by != null ? Number(r.updated_by) : null
  };
}

export async function getWithdrawalSettings(): Promise<WithdrawalSettingsRow> {
  const [rows]: any = await pool.query('SELECT * FROM withdrawal_settings WHERE id = ? LIMIT 1', [SETTINGS_ID]);
  if (!rows[0]) throw new ApiError(500, 'withdrawal_settings not seeded');
  return mapRow(rows[0]);
}

export async function getWithdrawalSettingsForUpdate(c: PoolConnection): Promise<WithdrawalSettingsRow> {
  const [rows]: any = await c.query('SELECT * FROM withdrawal_settings WHERE id = ? FOR UPDATE', [SETTINGS_ID]);
  if (!rows[0]) throw new ApiError(500, 'withdrawal_settings not seeded');
  return mapRow(rows[0]);
}

export type WithdrawalSettingsUpdateInput = {
  min_withdrawal_amount: number;
  max_withdrawal_amount: number | null;
  withdrawal_fee_type: 'fixed' | 'percentage';
  withdrawal_fee_value: number;
  kyc_required: boolean;
  auto_approve: boolean;
  allow_upi: boolean;
  allow_bank_transfer: boolean;
  one_pending_request_only: boolean;
};

export async function updateWithdrawalSettings(input: WithdrawalSettingsUpdateInput, adminUserId: number) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    await getWithdrawalSettingsForUpdate(c);
    await c.query(
      `UPDATE withdrawal_settings SET
         min_withdrawal_amount = ?,
         max_withdrawal_amount = ?,
         withdrawal_fee_type = ?,
         withdrawal_fee_value = ?,
         kyc_required = ?,
         auto_approve = ?,
         allow_upi = ?,
         allow_bank_transfer = ?,
         one_pending_request_only = ?,
         updated_by = ?
       WHERE id = ?`,
      [
        input.min_withdrawal_amount,
        input.max_withdrawal_amount,
        input.withdrawal_fee_type,
        input.withdrawal_fee_value,
        input.kyc_required ? 1 : 0,
        input.auto_approve ? 1 : 0,
        input.allow_upi ? 1 : 0,
        input.allow_bank_transfer ? 1 : 0,
        input.one_pending_request_only ? 1 : 0,
        adminUserId,
        SETTINGS_ID
      ]
    );
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
  return getWithdrawalSettings();
}

export function computeWithdrawalFee(gross: number, s: WithdrawalSettingsRow): { fee: number; net: number } {
  const g = Math.round((Number(gross) + Number.EPSILON) * 100) / 100;
  let fee = 0;
  if (s.withdrawal_fee_type === 'fixed') {
    fee = Math.round((Number(s.withdrawal_fee_value) + Number.EPSILON) * 100) / 100;
  } else {
    fee = Math.round((g * (Number(s.withdrawal_fee_value) / 100) + Number.EPSILON) * 100) / 100;
  }
  fee = Math.min(fee, g);
  const net = Math.round((g - fee + Number.EPSILON) * 100) / 100;
  return { fee, net: Math.max(0, net) };
}
