import { execute } from '../../db/mysql.js';
/** Total team BV = left carry + right carry (profit ₹ in binary pool). */
export function rankForTotalBv(totalBv) {
    const v = Number(totalBv);
    if (!Number.isFinite(v) || v < 0)
        return 'Starter';
    if (v >= 5_000_000)
        return 'Diamond';
    if (v >= 1_000_000)
        return 'Platinum';
    if (v >= 200_000)
        return 'Gold';
    if (v >= 50_000)
        return 'Silver';
    return 'Starter';
}
/**
 * Persists MLM rank on `users.rank` from combined leg BV.
 * Pass `conn` when already inside a transaction (e.g. binary payout).
 */
export async function updateUserRank(userId, totalBv, conn) {
    if (!Number.isFinite(userId) || userId <= 0)
        return 'Starter';
    const rank = rankForTotalBv(totalBv);
    if (conn) {
        await conn.query(`UPDATE users SET \`rank\` = ? WHERE id = ?`, [rank, userId]);
    }
    else {
        await execute(`UPDATE users SET \`rank\` = ? WHERE id = ?`, [rank, userId]);
    }
    return rank;
}
