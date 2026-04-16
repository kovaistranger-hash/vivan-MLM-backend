import { getAdminProfitPrediction } from './dashboard.service.js';
export async function adminProfitPrediction(_req, res) {
    const prediction = await getAdminProfitPrediction();
    res.json({ success: true, ...prediction });
}
