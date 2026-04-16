import { calculateUserScore } from './scoring.service.js';
export async function adminScoringRecalculate(req, res) {
    const userId = Number(req.params.userId);
    const r = await calculateUserScore(userId);
    res.json({ success: true, ...r });
}
