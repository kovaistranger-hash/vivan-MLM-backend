import type { PoolConnection } from 'mysql2/promise';
import { ApiError } from '../../utils/ApiError.js';

export type AutoPlacement = {
  parent_id: number;
  position: 'left' | 'right';
};

const BFS_BATCH_SIZE = 50;
/** Safety cap on BFS expansions (broken cycles / huge trees). */
const MAX_PLACEMENT_STEPS = 5000;

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(',');
}

/**
 * First free left/right slot under `sponsorId` using breadth-first search with batched DB reads.
 * `GET_LOCK` reduces races with concurrent registrations; unique `(placement_parent_user_id, placement_side)` enforces DB safety.
 */
export async function findPlacement(c: PoolConnection, sponsorId: number): Promise<AutoPlacement> {
  const sid = Math.trunc(Number(sponsorId));
  if (!Number.isFinite(sid) || sid <= 0) {
    throw new ApiError(400, 'Invalid sponsor for placement');
  }

  const lockName = `placement_${sid}`;
  const [lock]: any = await c.query('SELECT GET_LOCK(?, 10) AS got', [lockName]);
  if (!lock?.[0] || Number(lock[0].got) !== 1) {
    throw new ApiError(503, 'Placement busy');
  }

  let steps = 0;

  try {
    const queue: number[] = [sid];

    while (queue.length > 0) {
      if (steps++ > MAX_PLACEMENT_STEPS) {
        throw new ApiError(500, 'Placement search exceeded safety limit');
      }

      const batch = queue.splice(0, BFS_BATCH_SIZE);
      const ph = placeholders(batch.length);
      const [rows]: any = await c.query(
        `SELECT user_id, placement_parent_user_id, placement_side
         FROM referral_users
         WHERE placement_parent_user_id IN (${ph})`,
        batch
      );

      const map = new Map<number, { left: number | null; right: number | null }>();
      for (const id of batch) {
        map.set(id, { left: null, right: null });
      }

      for (const r of rows as Array<{ user_id: unknown; placement_parent_user_id: unknown; placement_side: unknown }>) {
        const parent = Number(r.placement_parent_user_id);
        const side = String(r.placement_side);
        const child = Number(r.user_id);
        const node = map.get(parent);
        if (!node) continue;
        if (side === 'left') node.left = child;
        else if (side === 'right') node.right = child;
      }

      for (const parent of batch) {
        const node = map.get(parent);
        if (!node) continue;

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
  } finally {
    await c.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
  }
}
