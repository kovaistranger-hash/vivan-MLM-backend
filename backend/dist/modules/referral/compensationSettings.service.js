import { pool } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
const SETTINGS_ID = 1;
export function serializeSettingsSnapshot(row) {
    return {
        welcome_bonus_enabled: !!row.welcome_bonus_enabled,
        welcome_bonus_amount: Number(row.welcome_bonus_amount),
        direct_income_enabled: !!row.direct_income_enabled,
        direct_income_type: row.direct_income_type,
        direct_income_value: Number(row.direct_income_value),
        trigger_stage: row.trigger_stage,
        max_direct_income_per_order: row.max_direct_income_per_order != null ? Number(row.max_direct_income_per_order) : null,
        binary_income_enabled: !!row.binary_income_enabled,
        binary_left_percentage: Number(row.binary_left_percentage),
        binary_right_percentage: Number(row.binary_right_percentage),
        binary_percentage: row.binary_percentage != null
            ? Number(row.binary_percentage)
            : Math.min(Number(row.binary_left_percentage), Number(row.binary_right_percentage)),
        carry_forward_enabled: !!row.carry_forward_enabled,
        daily_binary_ceiling: Number(row.daily_binary_ceiling),
        binary_ceiling_behavior: row.binary_ceiling_behavior,
        refund_reversal_enabled: !!row.refund_reversal_enabled,
        minimum_order_profit: Number(row.minimum_order_profit)
    };
}
function mapRow(r) {
    return {
        id: Number(r.id),
        welcome_bonus_enabled: Number(r.welcome_bonus_enabled),
        welcome_bonus_amount: Number(r.welcome_bonus_amount),
        direct_income_enabled: Number(r.direct_income_enabled),
        direct_income_type: r.direct_income_type,
        direct_income_value: Number(r.direct_income_value),
        trigger_stage: r.trigger_stage,
        max_direct_income_per_order: r.max_direct_income_per_order != null ? Number(r.max_direct_income_per_order) : null,
        binary_income_enabled: Number(r.binary_income_enabled),
        binary_left_percentage: Number(r.binary_left_percentage),
        binary_right_percentage: Number(r.binary_right_percentage),
        binary_percentage: r.binary_percentage != null
            ? Number(r.binary_percentage)
            : Math.min(Number(r.binary_left_percentage), Number(r.binary_right_percentage)),
        carry_forward_enabled: Number(r.carry_forward_enabled),
        daily_binary_ceiling: Number(r.daily_binary_ceiling),
        binary_ceiling_behavior: r.binary_ceiling_behavior,
        refund_reversal_enabled: Number(r.refund_reversal_enabled),
        minimum_order_profit: Number(r.minimum_order_profit),
        updated_at: r.updated_at,
        updated_by: r.updated_by != null ? Number(r.updated_by) : null
    };
}
export async function getCompensationSettings() {
    const [rows] = await pool.query('SELECT * FROM compensation_settings WHERE id = ? LIMIT 1', [SETTINGS_ID]);
    if (!rows[0])
        throw new ApiError(500, 'compensation_settings not seeded');
    return mapRow(rows[0]);
}
/** Lock row for update inside an existing transaction. */
export async function getCompensationSettingsForUpdate(c) {
    const [rows] = await c.query('SELECT * FROM compensation_settings WHERE id = ? FOR UPDATE', [SETTINGS_ID]);
    if (!rows[0])
        throw new ApiError(500, 'compensation_settings not seeded');
    return mapRow(rows[0]);
}
export async function updateCompensationSettings(input, adminUserId) {
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        await c.query('SELECT id FROM compensation_settings WHERE id = ? FOR UPDATE', [SETTINGS_ID]);
        await c.query(`UPDATE compensation_settings SET
         welcome_bonus_enabled = ?,
         welcome_bonus_amount = ?,
         direct_income_enabled = ?,
         direct_income_type = ?,
         direct_income_value = ?,
         trigger_stage = ?,
         max_direct_income_per_order = ?,
         binary_income_enabled = ?,
         binary_left_percentage = ?,
         binary_right_percentage = ?,
         binary_percentage = ?,
         carry_forward_enabled = ?,
         daily_binary_ceiling = ?,
         binary_ceiling_behavior = ?,
         refund_reversal_enabled = ?,
         minimum_order_profit = ?,
         updated_by = ?
       WHERE id = ?`, [
            input.welcome_bonus_enabled ? 1 : 0,
            input.welcome_bonus_amount,
            input.direct_income_enabled ? 1 : 0,
            input.direct_income_type,
            input.direct_income_value,
            input.trigger_stage,
            input.max_direct_income_per_order,
            input.binary_income_enabled ? 1 : 0,
            input.binary_left_percentage,
            input.binary_right_percentage,
            input.binary_percentage,
            input.carry_forward_enabled ? 1 : 0,
            input.daily_binary_ceiling,
            input.binary_ceiling_behavior,
            input.refund_reversal_enabled ? 1 : 0,
            input.minimum_order_profit,
            adminUserId,
            SETTINGS_ID
        ]);
        await c.commit();
    }
    catch (e) {
        await c.rollback();
        throw e;
    }
    finally {
        c.release();
    }
    return getCompensationSettings();
}
