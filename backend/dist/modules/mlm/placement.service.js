import { ApiError } from '../../utils/ApiError.js';
const BFS_BATCH_SIZE = 50;
/** Safety cap on BFS expansions (broken cycles / huge trees). */
const MAX_PLACEMENT_STEPS = 5000;
function placeholders(n) {
    return Array.from({ length: n }, () => '?').join(',');
}
/**
 * First free left/right slot under `sponsorId` using breadth-first search with batched DB reads.
 * `GET_LOCK` reduces races with concurrent registrations; unique `(placement_parent_user_id, placement_side)` enforces DB safety.
 */
export async function findPlacement(c, sponsorId) {
    const sid = Math.trunc(Number(sponsorId));
    if (!Number.isFinite(sid) || sid <= 0) {
        throw new ApiError(400, 'Invalid sponsor for placement');
    }
    const lockName = `placement_${sid}`;
    const [lock] = await c.query('SELECT GET_LOCK(?, 10) AS got', [lockName]);
    if (!lock?.[0] || Number(lock[0].got) !== 1) {
        throw new ApiError(503, 'Placement busy');
    }
    let steps = 0;
    try {
        const queue = [sid];
        while (queue.length > 0) {
            if (steps++ > MAX_PLACEMENT_STEPS) {
                throw new ApiError(500, 'Placement search exceeded safety limit');
            }
            const batch = queue.splice(0, BFS_BATCH_SIZE);
            const ph = placeholders(batch.length);
            const [rows] = await c.query(`SELECT user_id, placement_parent_user_id, placement_side
         FROM referral_users
         WHERE placement_parent_user_id IN (${ph})`, batch);
            const map = new Map();
            for (const id of batch) {
                map.set(id, { left: null, right: null });
            }
            for (const r of rows) {
                const parent = Number(r.placement_parent_user_id);
                const side = String(r.placement_side);
                const child = Number(r.user_id);
                const node = map.get(parent);
                if (!node)
                    continue;
                if (side === 'left')
                    node.left = child;
                else if (side === 'right')
                    node.right = child;
            }
            for (const parent of batch) {
                const node = map.get(parent);
                if (!node)
                    continue;
                if (node.left == null) {
                    return { parent_id: parent, position: 'left' };
                }
                if (node.right == null) {
                    return { parent_id: parent, position: 'right' };
                }
                queue.push(node.left, node.right);
            }
        }
        throw new ApiError(500, 'No placement found');
    }
    finally {
        await c.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
    }
}
