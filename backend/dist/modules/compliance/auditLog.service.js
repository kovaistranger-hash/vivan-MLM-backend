import { execute } from '../../db/mysql.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
export async function writeAuditLog(action, userId) {
    await ensureReferralSchemaExists();
    await execute(`INSERT INTO audit_logs (action, user_id) VALUES (:action, :userId)`, {
        action,
        userId: userId ?? null
    });
}
