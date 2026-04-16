import { query } from '../../db/mysql.js';

export function normalizePincode(pincode: string) {
  return pincode.replace(/\s+/g, '').trim();
}

export async function countActiveZones() {
  const rows = await query<{ c: number }[]>('SELECT COUNT(*) AS c FROM serviceable_pincodes WHERE is_active = 1');
  return Number(rows[0]?.c || 0);
}

export async function getActiveZoneByPincode(pincode: string) {
  const p = normalizePincode(pincode);
  if (!p) return null;
  const rows = await query<any[]>(
    'SELECT * FROM serviceable_pincodes WHERE pincode = :pincode AND is_active = 1 LIMIT 1',
    { pincode: p }
  );
  return rows[0] || null;
}
