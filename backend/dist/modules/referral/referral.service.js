import { pool, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
import { findPlacement } from '../mlm/placement.service.js';
import { ensureBinaryCarryRow } from '../mlm/commission.service.js';
import { bumpPlacementTreeStats, ensureTreeStatRow } from '../mlm/treeStats.service.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
import { getBinarySummaryForUser as mlmBinarySummaryPayload } from '../mlm/binarySummary.service.js';
export const WELCOME_BONUS_INR = 250;
const CODE_LEN = 8;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomReferralCode() {
    let s = '';
    for (let i = 0; i < CODE_LEN; i++) {
        s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return s;
}
function referralCodeFromRowField(rc) {
    if (rc == null)
        return '';
    if (Buffer.isBuffer(rc))
        return rc.toString('utf8').trim();
    if (typeof rc === 'string')
        return rc.trim();
    if (typeof rc === 'bigint')
        return String(rc).trim();
    if (typeof rc === 'object')
        return '';
    return String(rc).trim();
}
function isBlankReferralCode(rc) {
    return referralCodeFromRowField(rc) === '';
}
/** Positive integer id for `referral_users.user_id` (JWT `sub` may be number or numeric string). */
export function normalizeReferralUserId(userId) {
    if (typeof userId === 'bigint') {
        const n = Number(userId);
        return Number.isSafeInteger(n) && n > 0 ? n : null;
    }
    const n = Math.trunc(Number(userId));
    return Number.isFinite(n) && n > 0 ? n : null;
}
export async function getUserIdByReferralCode(code) {
    const c = String(code || '')
        .trim()
        .toUpperCase();
    if (!c)
        return null;
    const rows = await query('SELECT user_id FROM referral_users WHERE referral_code = :code LIMIT 1', { code: c });
    return rows[0] ? Number(rows[0].user_id) : null;
}
export async function generateUniqueReferralCode(c) {
    for (let i = 0; i < 30; i++) {
        const code = randomReferralCode();
        const [dup] = await c.query('SELECT user_id FROM referral_users WHERE referral_code = ? LIMIT 1', [code]);
        if (!dup[0])
            return code;
    }
    throw new ApiError(500, 'Could not allocate referral code');
}
/** True if `node` is `sponsor` or in sponsor's downline (excluding sponsor self as node requirement for placement). */
export async function isInSponsorDownline(c, sponsorUserId, nodeUserId) {
    if (nodeUserId === sponsorUserId)
        return true;
    const [rows] = await c.query(`SELECT 1 FROM referral_closure WHERE ancestor_user_id = ? AND descendant_user_id = ? AND depth >= 1 LIMIT 1`, [sponsorUserId, nodeUserId]);
    return !!rows[0];
}
/** True if `candidateParentId` is `operatorUserId` or a binary descendant (via placement_parent only). */
export async function isInOperatorBinarySubtree(c, operatorUserId, candidateParentId) {
    if (candidateParentId === operatorUserId)
        return true;
    const [rows] = await c.query(`WITH RECURSIVE bin_sub AS (
       SELECT CAST(? AS UNSIGNED) AS uid
       UNION
       SELECT ru.user_id
       FROM referral_users ru
       INNER JOIN bin_sub b ON ru.placement_parent_user_id = b.uid
     )
     SELECT 1 AS ok FROM bin_sub WHERE uid = ? LIMIT 1`, [operatorUserId, candidateParentId]);
    return !!rows[0];
}
export async function insertSelfClosure(c, userId) {
    await c.query(`INSERT IGNORE INTO referral_closure (ancestor_user_id, descendant_user_id, depth, leg_side) VALUES (?, ?, 0, NULL)`, [userId, userId]);
}
/** Copy closure rows from parent to new user and link (parent → user). */
export async function extendClosureForNewMember(c, userId, parentUserId, side) {
    await c.query(`INSERT INTO referral_closure (ancestor_user_id, descendant_user_id, depth, leg_side)
     SELECT ancestor_user_id, ?, depth + 1,
            CASE WHEN descendant_user_id = ? THEN ? ELSE leg_side END AS leg_side
     FROM referral_closure
     WHERE descendant_user_id = ?`, [userId, parentUserId, side, parentUserId]);
    await insertSelfClosure(c, userId);
}
export async function createReferralProfileForNewCustomer(c, userId, input) {
    await ensureBinaryCarryRow(c, userId);
    const code = await generateUniqueReferralCode(c);
    let sponsorId = null;
    if (input.sponsorReferralCode?.trim()) {
        sponsorId = await getUserIdByReferralCode(input.sponsorReferralCode.trim());
        if (!sponsorId)
            throw new ApiError(400, 'Invalid sponsor referral code');
        if (sponsorId === userId)
            throw new ApiError(400, 'Cannot sponsor yourself');
    }
    let placementParentId = null;
    let side = 'left';
    let level = 1;
    if (sponsorId) {
        const [slev] = await c.query('SELECT level FROM referral_users WHERE user_id = ? FOR UPDATE', [sponsorId]);
        if (slev[0] && slev[0].level != null) {
            level = Number(slev[0].level) + 1;
        }
        const explicitParentCode = input.placementParentReferralCode?.trim();
        if (explicitParentCode) {
            placementParentId = await getUserIdByReferralCode(explicitParentCode);
            if (!placementParentId)
                throw new ApiError(400, 'Invalid placement parent referral code');
            if (!(await isInSponsorDownline(c, sponsorId, placementParentId))) {
                throw new ApiError(400, 'Placement parent must be your sponsor or in your sponsor downline');
            }
            side = input.placementSide === 'right' ? 'right' : 'left';
        }
        else if (input.autoPlacement) {
            placementParentId = input.autoPlacement.parent_id;
            side = input.autoPlacement.position;
        }
        else {
            const slot = await findPlacement(c, sponsorId);
            placementParentId = slot.parent_id;
            side = slot.position;
        }
    }
    await c.query(`INSERT INTO referral_users (user_id, referral_code, sponsor_user_id, level, placement_parent_user_id, placement_side)
     VALUES (?, ?, ?, ?, ?, ?)`, [userId, code, sponsorId, level, placementParentId, placementParentId ? side : null]);
    await ensureTreeStatRow(c, userId);
    if (placementParentId) {
        await extendClosureForNewMember(c, userId, placementParentId, side);
        await bumpPlacementTreeStats(c, placementParentId, side);
    }
    else {
        await insertSelfClosure(c, userId);
    }
}
/**
 * Ensures `referral_users` exists and has a non-empty `referral_code`.
 * New signups get a row in `createReferralProfileForNewCustomer`; this also
 * backfills legacy rows that were missing a code (empty string / null).
 */
export async function ensureReferralProfileExists(userId) {
    await ensureReferralSchemaExists();
    const uid = normalizeReferralUserId(userId);
    if (uid == null)
        return;
    const rows = await query('SELECT user_id, referral_code FROM referral_users WHERE user_id = :u LIMIT 1', { u: uid });
    const existing = rows[0];
    if (existing?.user_id && !isBlankReferralCode(existing.referral_code)) {
        return;
    }
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        if (existing?.user_id && isBlankReferralCode(existing.referral_code)) {
            const newCode = await generateUniqueReferralCode(c);
            await c.query('UPDATE referral_users SET referral_code = ? WHERE user_id = ?', [newCode, uid]);
            await ensureBinaryCarryRow(c, uid);
            await c.commit();
            return;
        }
        const code = await generateUniqueReferralCode(c);
        await ensureBinaryCarryRow(c, uid);
        await c.query(`INSERT INTO referral_users (user_id, referral_code, sponsor_user_id, level, placement_parent_user_id, placement_side)
       VALUES (?, ?, NULL, 1, NULL, NULL)
       ON DUPLICATE KEY UPDATE user_id = user_id`, [uid, code]);
        await ensureTreeStatRow(c, uid);
        await c.commit();
    }
    catch (e) {
        await c.rollback();
        throw e;
    }
    finally {
        c.release();
    }
    try {
        const c2 = await pool.getConnection();
        await insertSelfClosure(c2, uid);
        c2.release();
    }
    catch (e) {
        console.error('[referral] insertSelfClosure after bootstrap (non-fatal)', e);
    }
}
const REFERRAL_ROW_SQL = `SELECT ru.*, su.email AS sponsor_email, su.name AS sponsor_name,
            pu.email AS placement_parent_email, pu.name AS placement_parent_name
     FROM referral_users ru
     LEFT JOIN users su ON su.id = ru.sponsor_user_id
     LEFT JOIN users pu ON pu.id = ru.placement_parent_user_id
     WHERE ru.user_id = :u LIMIT 1`;
export async function getReferralRow(userId) {
    const uid = normalizeReferralUserId(userId);
    if (uid == null)
        return null;
    await ensureReferralProfileExists(uid);
    let rows = await query(REFERRAL_ROW_SQL, { u: uid });
    let row = rows[0];
    if (row && isBlankReferralCode(row.referral_code)) {
        const c = await pool.getConnection();
        try {
            await c.beginTransaction();
            const newCode = await generateUniqueReferralCode(c);
            await c.query('UPDATE referral_users SET referral_code = ? WHERE user_id = ?', [newCode, uid]);
            await c.commit();
        }
        catch (e) {
            await c.rollback();
            throw e;
        }
        finally {
            c.release();
        }
        rows = await query(REFERRAL_ROW_SQL, { u: uid });
        row = rows[0];
    }
    return row || null;
}
/** Stable empty profile when no row (should be rare after `ensureReferralProfileExists`). */
export function emptyReferralProfile(userId) {
    return {
        user_id: userId,
        referral_code: '',
        referralCode: '',
        code: '',
        sponsor_user_id: null,
        placement_parent_user_id: null,
        placement_side: null,
        sponsor_email: null,
        sponsor_name: null,
        placement_parent_email: null,
        placement_parent_name: null,
        welcome_bonus_at: null,
        created_at: null,
        updated_at: null
    };
}
/** Plain JSON shape for `/referral/me` (avoids BigInt / driver quirks breaking `referral_code` in clients). */
export function toReferralProfileDto(row) {
    if (!row)
        return null;
    const num = (v) => {
        if (v == null || v === '')
            return null;
        if (typeof v === 'bigint')
            return Number(v);
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const rawCodeField = row.referral_code ?? row.referralCode ?? row.code;
    const referralCode = referralCodeFromRowField(rawCodeField);
    return {
        user_id: num(row.user_id),
        referral_code: referralCode,
        referralCode,
        code: referralCode,
        sponsor_user_id: num(row.sponsor_user_id),
        placement_parent_user_id: num(row.placement_parent_user_id),
        placement_side: row.placement_side != null ? String(row.placement_side) : null,
        sponsor_email: row.sponsor_email != null ? String(row.sponsor_email) : null,
        sponsor_name: row.sponsor_name != null ? String(row.sponsor_name) : null,
        placement_parent_email: row.placement_parent_email != null ? String(row.placement_parent_email) : null,
        placement_parent_name: row.placement_parent_name != null ? String(row.placement_parent_name) : null,
        welcome_bonus_at: row.welcome_bonus_at ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null
    };
}
export async function listDirectReferrals(userId) {
    await ensureReferralProfileExists(userId);
    return query(`SELECT u.id, u.name, u.email, ru.referral_code, ru.created_at,
            ru.placement_parent_user_id, ru.placement_side
     FROM referral_users ru
     INNER JOIN users u ON u.id = ru.user_id
     WHERE ru.sponsor_user_id = :s
     ORDER BY ru.user_id DESC`, { s: userId });
}
export async function getBinaryTreeChildren(userId) {
    return query(`SELECT u.id, u.name, u.email, ru.referral_code, ru.placement_side
     FROM referral_users ru
     INNER JOIN users u ON u.id = ru.user_id
     WHERE ru.placement_parent_user_id = :p
     ORDER BY ru.placement_side ASC, u.id ASC`, { p: userId });
}
/** Sponsor places a sponsored member who has no binary parent yet, under a valid leg of `parentUserId`. */
export async function placeBinaryUnderParent(operatorUserId, input) {
    const childCode = String(input.childReferralCode || '')
        .trim()
        .toUpperCase();
    const parentCode = String(input.parentReferralCode || '')
        .trim()
        .toUpperCase();
    if (!childCode || !parentCode)
        throw new ApiError(400, 'Referral codes required');
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        const childId = await getUserIdByReferralCode(childCode);
        if (!childId)
            throw new ApiError(400, 'Invalid member referral code');
        const parentId = await getUserIdByReferralCode(parentCode);
        if (!parentId)
            throw new ApiError(400, 'Invalid parent referral code');
        const [childRows] = await c.query(`SELECT user_id, sponsor_user_id, placement_parent_user_id, placement_side FROM referral_users WHERE user_id = ? FOR UPDATE`, [childId]);
        const child = childRows[0];
        if (!child)
            throw new ApiError(404, 'Member is not on file');
        if (Number(child.sponsor_user_id) !== operatorUserId) {
            throw new ApiError(403, 'You can only place members you personally sponsored');
        }
        if (!child.sponsor_user_id)
            throw new ApiError(400, 'Member has no sponsor');
        if (child.placement_parent_user_id != null) {
            throw new ApiError(400, 'Member is already placed in the binary tree');
        }
        if (childId === parentId)
            throw new ApiError(400, 'Invalid placement');
        if (!(await isInOperatorBinarySubtree(c, operatorUserId, parentId))) {
            throw new ApiError(400, 'Placement parent must be you or someone already under your binary tree (your left/right legs).');
        }
        const [dup] = await c.query(`SELECT user_id FROM referral_users WHERE placement_parent_user_id = ? AND placement_side = ? LIMIT 1`, [parentId, input.side]);
        if (dup[0])
            throw new ApiError(400, 'That position is already filled');
        await c.query(`UPDATE referral_users SET placement_parent_user_id = ?, placement_side = ? WHERE user_id = ?`, [parentId, input.side, childId]);
        await extendClosureForNewMember(c, childId, parentId, input.side);
        await bumpPlacementTreeStats(c, parentId, input.side);
        await c.commit();
    }
    catch (e) {
        await c.rollback();
        throw e;
    }
    finally {
        c.release();
    }
}
export function emptyBinaryTreeRoot(rootUserId) {
    return {
        id: rootUserId,
        name: '',
        email: '',
        referral_code: '',
        left: null,
        right: null
    };
}
export { zeroBinarySummaryPayload } from '../mlm/binarySummary.service.js';
export async function buildBinaryTreePreview(rootUserId, maxDepth) {
    await ensureReferralProfileExists(rootUserId);
    async function node(uid, depth) {
        const urows = await query(`SELECT u.id, u.name, u.email, ru.referral_code FROM users u
       INNER JOIN referral_users ru ON ru.user_id = u.id WHERE u.id = :id LIMIT 1`, { id: uid });
        const base = urows[0] || { id: uid, name: '', email: '', referral_code: '' };
        if (depth >= maxDepth) {
            return { ...base, childrenTruncated: true };
        }
        const ch = await getBinaryTreeChildren(uid);
        const leftRow = ch.find((c) => String(c.placement_side) === 'left');
        const rightRow = ch.find((c) => String(c.placement_side) === 'right');
        const leftId = leftRow != null ? Number(leftRow.id) : NaN;
        const rightId = rightRow != null ? Number(rightRow.id) : NaN;
        return {
            ...base,
            left: leftRow && Number.isFinite(leftId) && leftId > 0 ? await node(leftId, depth + 1) : null,
            right: rightRow && Number.isFinite(rightId) && rightId > 0 ? await node(rightId, depth + 1) : null
        };
    }
    return node(rootUserId, 0);
}
export async function listCommissionsForUser(userId, page, pageSize) {
    await ensureReferralProfileExists(userId);
    const limit = pageSize;
    const offset = (page - 1) * limit;
    const items = await query(`SELECT ct.*, o.order_number
     FROM commission_transactions ct
     LEFT JOIN orders o ON o.id = ct.order_id
     WHERE ct.user_id = :u
     ORDER BY ct.id DESC
     LIMIT :limit OFFSET :offset`, { u: userId, limit, offset });
    const countRows = await query(`SELECT COUNT(*) AS total FROM commission_transactions WHERE user_id = :u`, { u: userId });
    return { items, total: Number(countRows[0]?.total || 0) };
}
/** Binary + commission snapshot; ensures referral profile row exists first (codes / carry row). */
export async function getBinarySummaryForUser(userId) {
    await ensureReferralProfileExists(userId);
    return mlmBinarySummaryPayload(userId);
}
export async function listWalletCommissionImpact(userId, limit = 30) {
    await ensureReferralProfileExists(userId);
    return query(`SELECT id, type, amount, balance_after, description, reference_type, reference_id, created_at
     FROM wallet_transactions
     WHERE user_id = :u AND type IN ('commission_credit','bonus_credit')
     ORDER BY id DESC
     LIMIT :lim`, { u: userId, lim: limit });
}
export async function adminListReferralUsers(params) {
    await ensureReferralSchemaExists();
    const offset = (params.page - 1) * params.pageSize;
    const where = ['1=1'];
    const vals = { limit: params.pageSize, offset };
    if (params.q?.trim()) {
        where.push('(u.email LIKE :q OR u.name LIKE :q OR ru.referral_code LIKE :q OR CAST(u.id AS CHAR) = :exact)');
        const t = `%${params.q.trim()}%`;
        vals.q = t;
        vals.exact = params.q.trim();
    }
    const sql = `
    SELECT ru.*, u.name, u.email
    FROM referral_users ru
    INNER JOIN users u ON u.id = ru.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY ru.user_id DESC
    LIMIT :limit OFFSET :offset`;
    const items = await query(sql, vals);
    const { limit, offset: _o, ...countVals } = vals;
    const countRows = await query(`SELECT COUNT(*) AS total FROM referral_users ru INNER JOIN users u ON u.id = ru.user_id WHERE ${where.join(' AND ')}`, countVals);
    return { items, total: Number(countRows[0]?.total || 0) };
}
export async function adminGetReferralUserBundle(userId) {
    const profile = await getReferralRow(userId);
    if (!profile)
        return null;
    const directs = await listDirectReferrals(userId);
    const carryRows = await query(`SELECT * FROM binary_carry WHERE user_id = :u LIMIT 1`, { u: userId });
    const closureSample = await query(`SELECT ancestor_user_id, depth, leg_side FROM referral_closure WHERE descendant_user_id = :u AND depth BETWEEN 1 AND 4 ORDER BY depth ASC`, { u: userId });
    return { profile, directs, binaryCarry: carryRows[0] || null, ancestorsPreview: closureSample };
}
export async function adminListCommissions(params) {
    await ensureReferralSchemaExists();
    const offset = (params.page - 1) * params.pageSize;
    const where = ['1=1'];
    const vals = { limit: params.pageSize, offset };
    if (params.userId) {
        where.push('ct.user_id = :uid');
        vals.uid = params.userId;
    }
    if (params.type) {
        where.push('ct.commission_type = :ctype');
        vals.ctype = params.type;
    }
    const w = where.join(' AND ');
    const items = await query(`SELECT ct.*, u.email AS user_email, u.name AS user_name, o.order_number
     FROM commission_transactions ct
     INNER JOIN users u ON u.id = ct.user_id
     LEFT JOIN orders o ON o.id = ct.order_id
     WHERE ${w}
     ORDER BY ct.id DESC
     LIMIT :limit OFFSET :offset`, vals);
    const { limit, offset: _o, ...countVals } = vals;
    const countRows = await query(`SELECT COUNT(*) AS total FROM commission_transactions ct WHERE ${w}`, countVals);
    return { items, total: Number(countRows[0]?.total || 0) };
}
export async function adminListBinaryDaily(params) {
    await ensureReferralSchemaExists();
    const offset = (params.page - 1) * params.pageSize;
    const where = ['1=1'];
    const vals = { limit: params.pageSize, offset };
    if (params.userId) {
        where.push('b.user_id = :uid');
        vals.uid = params.userId;
    }
    if (params.from) {
        where.push('b.summary_date >= :from');
        vals.from = params.from;
    }
    if (params.to) {
        where.push('b.summary_date <= :to');
        vals.to = params.to;
    }
    const w = where.join(' AND ');
    const items = await query(`SELECT b.*, u.email, u.name
     FROM binary_daily_summary b
     INNER JOIN users u ON u.id = b.user_id
     WHERE ${w}
     ORDER BY b.summary_date DESC, b.user_id DESC
     LIMIT :limit OFFSET :offset`, vals);
    const { limit, offset: _o, ...countVals } = vals;
    const countRows = await query(`SELECT COUNT(*) AS total FROM binary_daily_summary b WHERE ${w}`, countVals);
    return { items, total: Number(countRows[0]?.total || 0) };
}
function sanitizeUserIds(ids) {
    return [...new Set(ids.map((i) => Math.trunc(Number(i))).filter((i) => Number.isFinite(i) && i > 0))];
}
function collectBinaryTreeUserIds(n, acc) {
    if (!n || n.id == null)
        return;
    acc.add(Number(n.id));
    if (n.left)
        collectBinaryTreeUserIds(n.left, acc);
    if (n.right)
        collectBinaryTreeUserIds(n.right, acc);
}
async function loadD3NodeStatsMap(userIds) {
    const map = new Map();
    const ids = sanitizeUserIds(userIds);
    for (const id of ids) {
        map.set(id, { leftBV: 0, rightBV: 0, carryL: 0, carryR: 0, bin: 0, dir: 0, teamL: 0, teamR: 0, level: 1 });
    }
    if (!ids.length)
        return map;
    const ph = ids.map(() => '?').join(',');
    const [rts, carries, comm, levels] = await Promise.all([
        query(`SELECT user_id, total_left_bv, total_right_bv, total_left_members, total_right_members
       FROM referral_tree_stats WHERE user_id IN (${ph})`, ids),
        query(`SELECT user_id, left_profit_carry, right_profit_carry FROM binary_carry WHERE user_id IN (${ph})`, ids),
        query(`SELECT user_id,
         COALESCE(SUM(CASE WHEN commission_type = 'binary_match' THEN wallet_amount ELSE 0 END), 0) AS bin,
         COALESCE(SUM(CASE WHEN commission_type = 'direct_referral' THEN wallet_amount ELSE 0 END), 0) AS dir
       FROM commission_transactions WHERE user_id IN (${ph}) GROUP BY user_id`, ids),
        query(`SELECT user_id, level FROM referral_users WHERE user_id IN (${ph})`, ids)
    ]);
    for (const r of rts || []) {
        const uid = Number(r.user_id);
        const cur = map.get(uid) || { leftBV: 0, rightBV: 0, carryL: 0, carryR: 0, bin: 0, dir: 0, teamL: 0, teamR: 0, level: 1 };
        cur.leftBV = Number(r.total_left_bv ?? 0);
        cur.rightBV = Number(r.total_right_bv ?? 0);
        cur.teamL = Number(r.total_left_members ?? 0);
        cur.teamR = Number(r.total_right_members ?? 0);
        map.set(uid, cur);
    }
    for (const r of carries || []) {
        const uid = Number(r.user_id);
        const cur = map.get(uid) || { leftBV: 0, rightBV: 0, carryL: 0, carryR: 0, bin: 0, dir: 0, teamL: 0, teamR: 0, level: 1 };
        cur.carryL = Number(r.left_profit_carry ?? 0);
        cur.carryR = Number(r.right_profit_carry ?? 0);
        map.set(uid, cur);
    }
    for (const r of comm || []) {
        const uid = Number(r.user_id);
        const cur = map.get(uid) || { leftBV: 0, rightBV: 0, carryL: 0, carryR: 0, bin: 0, dir: 0, teamL: 0, teamR: 0, level: 1 };
        cur.bin = Number(r.bin ?? 0);
        cur.dir = Number(r.dir ?? 0);
        map.set(uid, cur);
    }
    for (const r of levels || []) {
        const uid = Number(r.user_id);
        const cur = map.get(uid) || { leftBV: 0, rightBV: 0, carryL: 0, carryR: 0, bin: 0, dir: 0, teamL: 0, teamR: 0, level: 1 };
        cur.level = Math.max(1, Number(r.level ?? 1));
        map.set(uid, cur);
    }
    return map;
}
async function previewNodeToD3(n, stats, leg) {
    const id = Number(n.id);
    const s = stats.get(id) || { leftBV: 0, rightBV: 0, carryL: 0, carryR: 0, bin: 0, dir: 0, teamL: 0, teamR: 0, level: 1 };
    let weakLeg = 'balanced';
    if (s.carryL < s.carryR)
        weakLeg = 'left_carry';
    else if (s.carryR < s.carryL)
        weakLeg = 'right_carry';
    else if (s.leftBV < s.rightBV)
        weakLeg = 'left_bv';
    else if (s.rightBV < s.leftBV)
        weakLeg = 'right_bv';
    const children = [];
    if (!n.childrenTruncated) {
        if (n.left)
            children.push(await previewNodeToD3(n.left, stats, 'left'));
        if (n.right)
            children.push(await previewNodeToD3(n.right, stats, 'right'));
    }
    const totalInr = Math.round(s.bin + s.dir);
    const teamSize = s.teamL + s.teamR;
    const node = {
        name: `${n.name || 'Member'} · #${id}`,
        attributes: {
            leg,
            code: String(n.referral_code || ''),
            leftBV: Math.round(s.leftBV),
            rightBV: Math.round(s.rightBV),
            carryL: Math.round(s.carryL),
            carryR: Math.round(s.carryR),
            binaryInr: Math.round(s.bin),
            directInr: Math.round(s.dir),
            totalInr,
            teamSize,
            teamL: s.teamL,
            teamR: s.teamR,
            rankLevel: s.level,
            weakLeg
        }
    };
    if (children.length)
        node.children = children;
    return node;
}
/** Binary placement tree in `react-d3-tree` shape with BV / carry / income attributes. */
export async function getBinaryTreeD3ForUser(rootUserId, maxDepth) {
    await ensureReferralSchemaExists();
    const preview = await buildBinaryTreePreview(rootUserId, maxDepth);
    const idSet = new Set();
    collectBinaryTreeUserIds(preview, idSet);
    const stats = await loadD3NodeStatsMap([...idSet]);
    return previewNodeToD3(preview, stats, 'root');
}
