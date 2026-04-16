import { evaluateSystemRiskAndPersist, listRecentSystemAlerts } from './risk.service.js';
export async function adminRiskStatus(_req, res) {
    const snapshot = await evaluateSystemRiskAndPersist();
    const recentRows = await listRecentSystemAlerts(25);
    const recentAlerts = recentRows.map((r) => ({
        id: Number(r.id),
        type: r.alert_type,
        severity: r.severity,
        message: r.message,
        metadata: r.metadata_json,
        createdAt: typeof r.created_at === 'string' ? r.created_at : String(r.created_at)
    }));
    res.json({ success: true, ...snapshot, recentAlerts });
}
