import { adminRecalculateOrderCommissions } from '../mlm/commission.service.js';
import { adminGetReferralUserBundle, adminListBinaryDaily, adminListCommissions, adminListReferralUsers, buildBinaryTreePreview, getBinaryTreeD3ForUser } from './referral.service.js';
export async function adminReferralBinaryTreeD3(req, res) {
    const userId = Number(req.params.userId);
    const depth = Math.min(8, Math.max(1, Number(req.query.depth) || 5));
    const tree = await getBinaryTreeD3ForUser(userId, depth);
    res.json({ success: true, tree });
}
export async function adminReferralsUsersList(req, res) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const q = req.query.q ? String(req.query.q) : undefined;
    const data = await adminListReferralUsers({ q, page, pageSize });
    res.json({ success: true, ...data, page, pageSize });
}
export async function adminReferralsUserDetail(req, res) {
    const userId = Number(req.params.userId);
    const bundle = await adminGetReferralUserBundle(userId);
    if (!bundle)
        return res.status(404).json({ success: false, message: 'User not found' });
    const depth = Math.min(8, Math.max(1, Number(req.query.treeDepth) || 5));
    const binaryTree = await buildBinaryTreePreview(userId, depth);
    res.json({ success: true, ...bundle, binaryTree });
}
export async function adminCommissionsList(req, res) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const type = req.query.type ? String(req.query.type) : undefined;
    const data = await adminListCommissions({ userId, type, page, pageSize });
    res.json({ success: true, ...data, page, pageSize });
}
export async function adminBinaryDailyList(req, res) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const data = await adminListBinaryDaily({ userId, from, to, page, pageSize });
    res.json({ success: true, ...data, page, pageSize });
}
export async function adminCommissionsRecalculate(req, res) {
    const orderId = Number(req.params.orderId);
    const force = Boolean(req.body?.force);
    const result = await adminRecalculateOrderCommissions(orderId, force);
    res.json({ success: true, result });
}
