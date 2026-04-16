import { adminCreditUserWallet, adminDebitUserWallet, adminGetWalletDetail, adminListWallets, adminManualRefundToWallet, adminUnlockWalletFraudLock } from './adminWallet.service.js';
export async function adminWalletsList(req, res) {
    const q = req.validatedQuery;
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const { items, total } = await adminListWallets({ search: q.search, page, pageSize });
    res.json({
        success: true,
        wallets: items,
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    });
}
export async function adminWalletGet(req, res) {
    const userId = Number(req.params.userId);
    const data = await adminGetWalletDetail(userId);
    res.json({ success: true, ...data });
}
export async function adminWalletCredit(req, res) {
    const userId = Number(req.params.userId);
    const body = req.body;
    await adminCreditUserWallet(userId, req.user.id, body.amount, body.description);
    res.json({ success: true });
}
export async function adminWalletDebit(req, res) {
    const userId = Number(req.params.userId);
    const body = req.body;
    await adminDebitUserWallet(userId, req.user.id, body.amount, body.description);
    res.json({ success: true });
}
export async function adminWalletRefund(req, res) {
    const userId = Number(req.params.userId);
    const body = req.body;
    await adminManualRefundToWallet(userId, req.user.id, body.amount, body.description, body.reference_type, body.reference_id);
    res.json({ success: true });
}
export async function adminWalletUnlockFraud(req, res) {
    const userId = Number(req.params.userId);
    await adminUnlockWalletFraudLock(userId);
    res.json({ success: true });
}
