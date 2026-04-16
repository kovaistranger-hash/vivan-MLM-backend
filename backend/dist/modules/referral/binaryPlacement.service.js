import { ApiError } from '../../utils/ApiError.js';
import { getBestSpilloverRootUserId } from './spillover.service.js';
const BFS_BATCH_SIZE = 50;
/** Max binary depth to scan from spillover root (prevents unbounded BFS). */
const MAX_BFS_DEPTH = 20;
function placeholders(n) {
    return Array.from({ length: n }, () => '?').join(',');
}
/** Payout carry from `binary_carry` (batched). */
async function getLegBvBatch(c, userIds) {
    const map = new Map();
    if (userIds.length === 0)
        return map;
    for (const id of userIds) {
        map.set(id, { left_bv: 0, right_bv: 0 });
    }
    const ph = placeholders(userIds.length);
    const [rows] = await c.query(`SELECT user_id, left_profit_carry, right_profit_carry FROM binary_carry WHERE user_id IN (${ph})`, userIds);
    for (const r of rows) {
        const id = Number(r.user_id);
        map.set(id, {
            left_bv: Number(r.left_profit_carry ?? 0),
            right_bv: Number(r.right_profit_carry ?? 0)
        });
    }
    return map;
}
/** Team / placement signals from `referral_tree_stats` (batched). */
async function getTreeStatsBatch(c, userIds) {
    const map = new Map();
    if (userIds.length === 0)
        return map;
    for (const id of userIds) {
        map.set(id, { lm: 0, rm: 0, lb: 0, rb: 0 });
    }
    const ph = placeholders(userIds.length);
    try {
        const [rows] = await c.query(`SELECT user_id, total_left_members, total_right_members, total_left_bv, total_right_bv
       FROM referral_tree_stats WHERE user_id IN (${ph})`, userIds);
        for (const r of rows) {
            map.set(Number(r.user_id), {
                lm: Number(r.total_left_members ?? 0),
                rm: Number(r.total_right_members ?? 0),
                lb: Number(r.total_left_bv ?? 0),
                rb: Number(r.total_right_bv ?? 0)
            });
        }
    }
    catch {
        /* table may not exist on very old DBs before migration — treat as zeros */
    }
    return map;
}
/**
 * Per-node placement weights: tree_stats (team / BV signals) + carry from `binary_carry` for payout-side imbalance.
 * Weaker leg = smaller `left_score` / `right_score` (same idea as `getLegBv(c, current)` per node, batched).
 */
async function getPlacementSignalsBatch(c, userIds) {
    const [carryMap, treeMap] = await Promise.all([getLegBvBatch(c, userIds), getTreeStatsBatch(c, userIds)]);
    const out = new Map();
    for (const id of userIds) {
        const bc = carryMap.get(id) ?? { left_bv: 0, right_bv: 0 };
        const ts = treeMap.get(id) ?? { lm: 0, rm: 0, lb: 0, rb: 0 };
        const leftScore = ts.lm + ts.lb + bc.left_bv;
        const rightScore = ts.rm + ts.rb + bc.right_bv;
        out.set(id, { left_bv: leftScore, right_bv: rightScore });
    }
    return out;
}
async function getPlacementChildrenBatch(c, parentIds) {
    const map = new Map();
    if (parentIds.length === 0)
        return map;
    for (const id of parentIds) {
        map.set(id, { left_child_id: null, right_child_id: null });
    }
    const ph = placeholders(parentIds.length);
    const [rows] = await c.query(`SELECT user_id, placement_parent_user_id, placement_side
     FROM referral_users
     WHERE placement_parent_user_id IN (${ph})`, parentIds);
    for (const r of rows) {
        const parent = Number(r.placement_parent_user_id);
        const side = String(r.placement_side);
        const child = Number(r.user_id);
        const node = map.get(parent);
        if (!node)
            continue;
        if (side === 'left')
            node.left_child_id = child;
        else if (side === 'right')
            node.right_child_id = child;
    }
    return map;
}
function failsafePlacement(sponsorId) {
    return { parent_id: sponsorId, position: 'left' };
}
/**
 * Auto binary placement: BFS from spillover root (default = sponsor), level-by-level, max depth,
 * per-node weak leg from `referral_tree_stats` + `binary_carry` (batched queries per frontier).
 * DB unique `uq_referral_placement_leg` prevents duplicate leg; `GET_LOCK` reduces races.
 */
export async function findPlacement(c, sponsorId) {
    const lockName = `binary_auto_place_${sponsorId}`;
    const [lockRows] = await c.query(`SELECT GET_LOCK(?, 10) AS got`, [lockName]);
    if (!lockRows?.[0] || Number(lockRows[0].got) !== 1) {
        throw new ApiError(503, 'Placement busy, try again');
    }
    try {
        const rootUserId = await getBestSpilloverRootUserId(c, sponsorId);
        let frontier = [rootUserId];
        let depth = 0;
        while (frontier.length > 0) {
            if (depth >= MAX_BFS_DEPTH) {
                return failsafePlacement(sponsorId);
            }
            const nextFrontier = [];
            for (let i = 0; i < frontier.length; i += BFS_BATCH_SIZE) {
                const chunk = frontier.slice(i, i + BFS_BATCH_SIZE);
                const [signalsMap, childrenMap] = await Promise.all([
                    getPlacementSignalsBatch(c, chunk),
                    getPlacementChildrenBatch(c, chunk)
                ]);
                for (const current of chunk) {
                    const legs = signalsMap.get(current) ?? { left_bv: 0, right_bv: 0 };
                    const preferredSide = legs.left_bv <= legs.right_bv ? 'left' : 'right';
                    const node = childrenMap.get(current);
                    const prefKey = preferredSide === 'left' ? 'left_child_id' : 'right_child_id';
                    if (!node[prefKey]) {
                        return {
                            parent_id: current,
                            position: preferredSide
                        };
                    }
                    if (node.left_child_id != null)
                        nextFrontier.push(node.left_child_id);
                    if (node.right_child_id != null)
                        nextFrontier.push(node.right_child_id);
                }
            }
            frontier = nextFrontier;
            depth++;
        }
        return failsafePlacement(sponsorId);
    }
    finally {
        await c.query(`SELECT RELEASE_LOCK(?) AS _rel`, [lockName]);
    }
}
