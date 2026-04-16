import { query } from '../../db/mysql.js';
import { getCompensationSettings } from './compensationSettings.service.js';
export async function adminBinaryCarryList(params) {
    const settings = await getCompensationSettings();
    const ceilingDefault = round2(Number(settings.daily_binary_ceiling));
    const indiaRows = await query(`SELECT DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')) AS d`);
    const istDate = indiaRows[0]?.d || '';
    const offset = (params.page - 1) * params.pageSize;
    const where = ['1=1'];
    const vals = {
        limit: params.pageSize,
        offset,
        istDate,
        ceilingDefault
    };
    if (params.q?.trim()) {
        where.push('(u.email LIKE :q OR u.name LIKE :q OR CAST(u.id AS CHAR) = :exact)');
        vals.q = `%${params.q.trim()}%`;
        vals.exact = params.q.trim();
    }
    const w = where.join(' AND ');
    const sql = `
    SELECT
      u.id AS user_id,
      u.name,
      u.email,
      COALESCE(bc.left_profit_carry, 0) AS left_profit_carry,
      COALESCE(bc.right_profit_carry, 0) AS right_profit_carry,
      COALESCE(bds.binary_paid_total, 0) AS binary_paid_today,
      COALESCE(bds.ceiling_blocked_total, 0) AS ceiling_blocked_today,
      (
        SELECT COALESCE(SUM(ct.gross_amount), 0)
        FROM commission_transactions ct
        WHERE ct.user_id = u.id
          AND ct.commission_type = 'binary_match'
          AND DATE(CONVERT_TZ(ct.created_at, '+00:00', '+05:30')) = :istDate
      ) AS matched_volume_today
    FROM users u
    LEFT JOIN binary_carry bc ON bc.user_id = u.id
    LEFT JOIN binary_daily_summary bds ON bds.user_id = u.id AND bds.summary_date = :istDate
    INNER JOIN roles r ON r.id = u.role_id AND r.slug = 'customer'
    WHERE ${w}
    ORDER BY u.id DESC
    LIMIT :limit OFFSET :offset
  `;
    const items = await query(sql, vals);
    const { limit, offset: _o, istDate: _d, ceilingDefault: _c, ...countVals } = vals;
    const countRows = await query(`SELECT COUNT(*) AS total FROM users u INNER JOIN roles r ON r.id = u.role_id AND r.slug = 'customer' WHERE ${w}`, countVals);
    const enriched = items.map((row) => {
        const paid = round2(Number(row.binary_paid_today));
        const rem = round2(Math.max(0, ceilingDefault - paid));
        return {
            ...row,
            daily_binary_ceiling: ceilingDefault,
            remaining_ceiling_today: rem
        };
    });
    return { items: enriched, total: Number(countRows[0]?.total || 0), ceilingDefault, istDate };
}
function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
