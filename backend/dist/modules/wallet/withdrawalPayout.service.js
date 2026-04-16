import { env } from '../../config/env.js';
import { execute, query } from '../../db/mysql.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
/**
 * Records a payout row when a withdrawal is marked paid, and optionally calls Razorpay X Payouts.
 * For production bank transfers you typically create a Razorpay **fund account** per beneficiary;
 * when `RAZORPAY_PAYOUT_*` env vars below are unset, we record `success` with reference `manual:{withdrawalId}`
 * (meaning settlement was completed or will be completed outside this API).
 */
export async function onWithdrawalMarkedPaid(withdrawalId) {
    await ensureReferralSchemaExists();
    const rows = await query(`SELECT wr.id, wr.user_id, wr.net_amount, wr.status FROM withdrawal_requests wr WHERE wr.id = :id LIMIT 1`, { id: withdrawalId });
    const wr = rows[0];
    if (!wr || String(wr.status) !== 'paid')
        return;
    const existing = await query(`SELECT id FROM payouts WHERE withdrawal_request_id = :wid LIMIT 1`, { wid: withdrawalId });
    if (existing[0])
        return;
    const net = Number(wr.net_amount);
    const userId = Number(wr.user_id);
    const ins = await execute(`INSERT INTO payouts (withdrawal_request_id, user_id, amount, status, reference_id, provider)
     VALUES (:wid, :uid, :amt, 'pending', NULL, 'razorpay')`, { wid: withdrawalId, uid: userId, amt: net });
    const payoutId = Number(ins.insertId);
    const keyId = env.razorpayPayoutKeyId;
    const secret = env.razorpayPayoutKeySecret;
    const fundAccountId = env.razorpayPayoutFundAccountId;
    const sourceAccount = env.razorpayPayoutSourceAccountNumber;
    if (!keyId || !secret || !fundAccountId || !sourceAccount) {
        await execute(`UPDATE payouts SET status = 'success', reference_id = :ref WHERE id = :id`, {
            ref: `manual:${withdrawalId}`,
            id: payoutId
        });
        return;
    }
    try {
        const amountPaise = Math.round(net * 100);
        const reference_id = `wr_${withdrawalId}_${payoutId}`;
        const auth = Buffer.from(`${keyId}:${secret}`).toString('base64');
        const body = {
            account_number: sourceAccount,
            fund_account_id: fundAccountId,
            amount: amountPaise,
            currency: 'INR',
            mode: 'IMPS',
            purpose: 'payout',
            reference_id,
            queue_if_low_balance: true
        };
        const r = await fetch('https://api.razorpay.com/v1/payouts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${auth}`
            },
            body: JSON.stringify(body)
        });
        const j = (await r.json().catch(() => ({})));
        if (!r.ok) {
            await execute(`UPDATE payouts SET status = 'failed', error_message = :msg WHERE id = :id`, {
                msg: String(j?.error?.description || r.statusText).slice(0, 500),
                id: payoutId
            });
            return;
        }
        await execute(`UPDATE payouts SET status = 'success', reference_id = :ref WHERE id = :id`, {
            ref: String(j?.id || reference_id).slice(0, 100),
            id: payoutId
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await execute(`UPDATE payouts SET status = 'failed', error_message = :msg WHERE id = :id`, {
            msg: msg.slice(0, 500),
            id: payoutId
        });
    }
}
