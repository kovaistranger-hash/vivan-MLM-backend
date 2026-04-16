import type { PoolConnection } from 'mysql2/promise';

/** Ensures a `referral_tree_stats` row exists for placement / team signals (separate from payout carry). */
export async function ensureTreeStatRow(c: PoolConnection, userId: number) {
  await c.query(
    `INSERT IGNORE INTO referral_tree_stats (user_id, total_left_members, total_right_members, total_left_bv, total_right_bv)
     VALUES (?, 0, 0, 0, 0)`,
    [userId]
  );
}

/** After a member is placed under `parentUserId` on `side`, bump direct leg member counts (placement signal). */
export async function bumpPlacementTreeStats(c: PoolConnection, parentUserId: number, side: 'left' | 'right') {
  await ensureTreeStatRow(c, parentUserId);
  if (side === 'left') {
    await c.query(
      `UPDATE referral_tree_stats SET total_left_members = total_left_members + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [parentUserId]
    );
  } else {
    await c.query(
      `UPDATE referral_tree_stats SET total_right_members = total_right_members + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [parentUserId]
    );
  }
}
