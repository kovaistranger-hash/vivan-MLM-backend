import { getCompensationSettings, updateCompensationSettings } from './compensationSettings.service.js';
import { createManualAdjustment, listManualAdjustments, createCarryAdjustment } from './manualAdjustment.service.js';
import { adminBinaryCarryList, runBinaryStandstillForUser } from './binary.service.js';
import { pool } from '../../db/mysql.js';
export async function adminGetCompensationSettings(_req, res) {
    const settings = await getCompensationSettings();
    res.json({ success: true, settings });
}
export async function adminPutCompensationSettings(req, res) {
    const body = req.body;
    const updated = await updateCompensationSettings({
        welcome_bonus_enabled: body.welcome_bonus_enabled,
        welcome_bonus_amount: body.welcome_bonus_amount,
        direct_income_enabled: body.direct_income_enabled,
        direct_income_type: body.direct_income_type,
        direct_income_value: body.direct_income_value,
        trigger_stage: body.trigger_stage,
        max_direct_income_per_order: body.max_direct_income_per_order ?? null,
        binary_income_enabled: body.binary_income_enabled,
        binary_left_percentage: body.binary_left_percentage,
        binary_right_percentage: body.binary_right_percentage,
        binary_percentage: body.binary_percentage,
        carry_forward_enabled: body.carry_forward_enabled,
        daily_binary_ceiling: body.daily_binary_ceiling,
        binary_ceiling_behavior: body.binary_ceiling_behavior,
        refund_reversal_enabled: body.refund_reversal_enabled,
        minimum_order_profit: body.minimum_order_profit
    }, req.user.id);
    res.json({ success: true, settings: updated });
}
export async function adminPostManualAdjustment(req, res) {
    const body = req.body;
    const r = await createManualAdjustment({
        userId: Number(body.userId),
        orderId: body.orderId != null ? Number(body.orderId) : null,
        adjustmentType: body.adjustmentType,
        amount: Number(body.amount),
        action: body.action,
        reason: body.reason,
        applyToWallet: !!body.applyToWallet,
        createdBy: req.user.id
    });
    res.status(201).json({ success: true, ...r });
}
export async function adminListManualAdjustments(req, res) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const data = await listManualAdjustments({ page, pageSize, userId });
    res.json({ success: true, ...data, page, pageSize });
}
export async function adminBinaryCarryListController(req, res) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const q = req.query.q ? String(req.query.q) : undefined;
    const data = await adminBinaryCarryList({ q, page, pageSize });
    res.json({ success: true, ...data, page, pageSize });
}
export async function adminBinaryCarryAdjust(req, res) {
    const userId = Number(req.params.userId);
    const body = req.body;
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        await createCarryAdjustment(c, {
            userId,
            side: body.side,
            delta: body.side === 'reset' ? 0 : Number(body.delta),
            reason: body.reason,
            createdBy: req.user.id
        });
        await c.commit();
    }
    catch (e) {
        await c.rollback();
        throw e;
    }
    finally {
        c.release();
    }
    res.json({ success: true });
}
export async function adminBinaryCarryRecalculate(req, res) {
    const userId = Number(req.params.userId);
    const r = await runBinaryStandstillForUser(userId);
    res.json({ success: true, ...r });
}
