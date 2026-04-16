import { ApiError } from '../../utils/ApiError.js';
import * as withdrawalService from './withdrawal.service.js';
import { getWithdrawalSettings, updateWithdrawalSettings } from './withdrawalSettings.service.js';
export async function adminWithdrawalsList(req, res) {
    const q = req.validatedQuery;
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const { items, total } = await withdrawalService.adminListWithdrawals({
        status: q.status,
        userId: q.userId,
        from: q.from,
        to: q.to,
        page,
        pageSize
    });
    res.json({
        success: true,
        withdrawals: items,
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    });
}
export async function adminWithdrawalGet(req, res) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'Invalid id');
    const data = await withdrawalService.adminGetWithdrawal(id);
    if (!data)
        throw new ApiError(404, 'Withdrawal not found');
    res.json({ success: true, ...data });
}
export async function adminWithdrawalApprove(req, res) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'Invalid id');
    const body = req.validatedBody;
    const data = await withdrawalService.adminApproveWithdrawal(id, req.user.id, body.remarks);
    res.json({ success: true, ...data });
}
export async function adminWithdrawalReject(req, res) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'Invalid id');
    const body = req.validatedBody;
    const data = await withdrawalService.adminRejectWithdrawal(id, req.user.id, body.remarks);
    res.json({ success: true, ...data });
}
export async function adminWithdrawalMarkPaid(req, res) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        throw new ApiError(400, 'Invalid id');
    const body = req.validatedBody;
    const data = await withdrawalService.adminMarkWithdrawalPaid(id, req.user.id, body.remarks);
    res.json({ success: true, ...data });
}
export async function adminWithdrawalSettingsGet(_req, res) {
    const settings = await getWithdrawalSettings();
    res.json({
        success: true,
        settings: {
            minWithdrawalAmount: settings.min_withdrawal_amount,
            maxWithdrawalAmount: settings.max_withdrawal_amount,
            withdrawalFeeType: settings.withdrawal_fee_type,
            withdrawalFeeValue: settings.withdrawal_fee_value,
            kycRequired: !!settings.kyc_required,
            autoApprove: !!settings.auto_approve,
            allowUpi: !!settings.allow_upi,
            allowBankTransfer: !!settings.allow_bank_transfer,
            onePendingRequestOnly: !!settings.one_pending_request_only,
            updatedAt: settings.updated_at,
            updatedBy: settings.updated_by
        }
    });
}
export async function adminWithdrawalSettingsPut(req, res) {
    const body = req.validatedBody;
    const updated = await updateWithdrawalSettings({
        min_withdrawal_amount: body.min_withdrawal_amount,
        max_withdrawal_amount: body.max_withdrawal_amount ?? null,
        withdrawal_fee_type: body.withdrawal_fee_type,
        withdrawal_fee_value: body.withdrawal_fee_value,
        kyc_required: body.kyc_required,
        auto_approve: body.auto_approve,
        allow_upi: body.allow_upi,
        allow_bank_transfer: body.allow_bank_transfer,
        one_pending_request_only: body.one_pending_request_only
    }, req.user.id);
    res.json({
        success: true,
        settings: {
            minWithdrawalAmount: updated.min_withdrawal_amount,
            maxWithdrawalAmount: updated.max_withdrawal_amount,
            withdrawalFeeType: updated.withdrawal_fee_type,
            withdrawalFeeValue: updated.withdrawal_fee_value,
            kycRequired: !!updated.kyc_required,
            autoApprove: !!updated.auto_approve,
            allowUpi: !!updated.allow_upi,
            allowBankTransfer: !!updated.allow_bank_transfer,
            onePendingRequestOnly: !!updated.one_pending_request_only,
            updatedAt: updated.updated_at,
            updatedBy: updated.updated_by
        }
    });
}
