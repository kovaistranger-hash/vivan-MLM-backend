import { pool, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
export async function listBankAccounts(userId) {
    return query(`SELECT * FROM bank_accounts WHERE user_id = :u ORDER BY is_default DESC, id DESC`, { u: userId });
}
export async function getBankAccount(userId, id) {
    const rows = await query(`SELECT * FROM bank_accounts WHERE id = :id AND user_id = :u LIMIT 1`, { id, u: userId });
    return rows[0] || null;
}
async function clearDefaultExcept(c, userId, exceptId) {
    await c.query('UPDATE bank_accounts SET is_default = 0 WHERE user_id = ? AND (? IS NULL OR id <> ?)', [
        userId,
        exceptId,
        exceptId
    ]);
}
export async function createBankAccount(userId, input) {
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        const [count] = await c.query('SELECT COUNT(*) AS n FROM bank_accounts WHERE user_id = ?', [userId]);
        const isFirst = Number(count[0]?.n ?? 0) === 0;
        const wantsDefault = isFirst || !!input.is_default;
        if (wantsDefault)
            await clearDefaultExcept(c, userId, null);
        const [ins] = await c.query(`INSERT INTO bank_accounts (
         user_id, account_holder_name, bank_name, account_number, ifsc_code, branch_name, upi_id, is_default, is_verified
       ) VALUES (?,?,?,?,?,?,?,?,0)`, [
            userId,
            input.account_holder_name.trim(),
            input.bank_name.trim(),
            input.account_number?.trim() || null,
            input.ifsc_code?.trim().toUpperCase() || null,
            input.branch_name?.trim() || null,
            input.upi_id?.trim() || null,
            wantsDefault ? 1 : 0
        ]);
        const id = Number(ins.insertId);
        await c.commit();
        return getBankAccount(userId, id);
    }
    catch (e) {
        await c.rollback();
        throw e;
    }
    finally {
        c.release();
    }
}
export async function updateBankAccount(userId, id, input) {
    const existing = await getBankAccount(userId, id);
    if (!existing)
        throw new ApiError(404, 'Bank account not found');
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        let nextDefault = Number(existing.is_default) ? 1 : 0;
        if (input.is_default === true)
            nextDefault = 1;
        else if (input.is_default === false)
            nextDefault = 0;
        if (nextDefault === 1)
            await clearDefaultExcept(c, userId, id);
        await c.query(`UPDATE bank_accounts SET
         account_holder_name = ?, bank_name = ?, account_number = ?, ifsc_code = ?, branch_name = ?, upi_id = ?,
         is_default = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`, [
            input.account_holder_name.trim(),
            input.bank_name.trim(),
            input.account_number?.trim() || null,
            input.ifsc_code?.trim().toUpperCase() || null,
            input.branch_name?.trim() || null,
            input.upi_id?.trim() || null,
            nextDefault,
            id,
            userId
        ]);
        await c.commit();
        return getBankAccount(userId, id);
    }
    catch (e) {
        await c.rollback();
        throw e;
    }
    finally {
        c.release();
    }
}
export async function deleteBankAccount(userId, id) {
    const [ref] = await pool.query(`SELECT id FROM withdrawal_requests WHERE bank_account_id = ? AND status IN ('pending','approved') LIMIT 1`, [id]);
    if (ref[0])
        throw new ApiError(400, 'Cannot delete bank account linked to an open withdrawal');
    const r = await executeDelete(userId, id);
    if (!r)
        throw new ApiError(404, 'Bank account not found');
}
async function executeDelete(userId, id) {
    const [res] = await pool.query('DELETE FROM bank_accounts WHERE id = ? AND user_id = ?', [id, userId]);
    return Number(res.affectedRows || 0) > 0;
}
