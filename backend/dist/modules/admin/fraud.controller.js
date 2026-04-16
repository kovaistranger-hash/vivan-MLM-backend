import { adminFraudOverview, evaluateFraudRiskForUser } from './fraud.service.js';
export async function adminFraudOverviewGet(_req, res) {
    const data = await adminFraudOverview();
    res.json({ success: true, ...data });
}
export async function adminFraudScanUser(req, res) {
    const userId = Number(req.params.userId);
    const result = await evaluateFraudRiskForUser(userId);
    res.json({ success: true, ...result });
}
