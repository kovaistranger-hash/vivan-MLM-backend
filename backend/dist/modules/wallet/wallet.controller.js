import { ApiError } from '../../utils/ApiError.js';
import { computeOrderPricing } from '../orders/order.service.js';
import { clearCheckoutIntent, getOrCreateWallet, getWalletBalance, getWalletSummaryForUser, listWalletTransactions, setCheckoutIntent } from './wallet.service.js';
export async function walletGetSummary(req, res) {
    const userId = req.user.id;
    const summary = await getWalletSummaryForUser(userId);
    res.json({ success: true, wallet: summary });
}
export async function walletListTransactions(req, res) {
    const q = req.validatedQuery;
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const { items, total } = await listWalletTransactions({ userId: req.user.id, page, pageSize });
    res.json({
        success: true,
        transactions: items,
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    });
}
export async function walletUse(req, res) {
    const body = req.body;
    const userId = req.user.id;
    await getOrCreateWallet(userId);
    const priced = await computeOrderPricing(userId, body.pincode, { walletApplyAmount: body.amount });
    if (!priced.ok)
        throw new ApiError(400, priced.message);
    const balance = await getWalletBalance(userId);
    const maxAllow = priced.grossTotal;
    const applied = await setCheckoutIntent(userId, body.amount, maxAllow, balance);
    res.json({
        success: true,
        appliedAmount: applied,
        grossTotal: priced.grossTotal,
        payableTotal: priced.payableTotal,
        walletBalance: balance
    });
}
export async function walletRemove(req, res) {
    await clearCheckoutIntent(req.user.id);
    res.json({ success: true });
}
