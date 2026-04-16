import { getAdminDashboardMetrics } from './dashboard.service.js';
export async function adminDashboard(_req, res) {
    const metrics = await getAdminDashboardMetrics();
    res.json({ success: true, metrics });
}
