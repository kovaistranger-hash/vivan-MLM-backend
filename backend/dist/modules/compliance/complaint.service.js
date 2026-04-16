import { execute, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
import { writeAuditLog } from './auditLog.service.js';
export async function createComplaint(userId, message) {
    await ensureReferralSchemaExists();
    const res = await execute(`INSERT INTO complaints (user_id, message) VALUES (:userId, :message)`, {
        userId,
        message
    });
    const id = Number(res.insertId);
    await writeAuditLog(`complaint_created:${id}`, userId);
    return { id, status: 'open' };
}
export async function adminListComplaints(params) {
    await ensureReferralSchemaExists();
    const where = ['1=1'];
    const vals = {
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize
    };
    if (params.status) {
        where.push('c.status = :st');
        vals.st = params.status;
    }
    const w = where.join(' AND ');
    const items = await query(`SELECT c.*, u.email AS user_email, u.name AS user_name
     FROM complaints c
     INNER JOIN users u ON u.id = c.user_id
     WHERE ${w}
     ORDER BY c.id DESC
     LIMIT :limit OFFSET :offset`, vals);
    const { limit, offset, ...countVals } = vals;
    const countRows = await query(`SELECT COUNT(*) AS total FROM complaints c WHERE ${w}`, countVals);
    return { items, total: Number(countRows[0]?.total ?? 0) };
}
export async function adminUpdateComplaintStatus(complaintId, status) {
    await ensureReferralSchemaExists();
    const rows = await query(`SELECT id FROM complaints WHERE id = :id LIMIT 1`, {
        id: complaintId
    });
    if (!rows[0])
        throw new ApiError(404, 'Complaint not found');
    await execute(`UPDATE complaints SET status = :status WHERE id = :id`, { status, id: complaintId });
    await writeAuditLog(`complaint_status:${complaintId}:${status}`, null);
    return { id: complaintId, status };
}
