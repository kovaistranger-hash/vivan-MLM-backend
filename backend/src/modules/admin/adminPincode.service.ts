import { execute, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';

export async function adminListPincodes() {
  return query<any[]>('SELECT * FROM serviceable_pincodes ORDER BY pincode ASC');
}

export async function adminCreatePincode(input: {
  pincode: string;
  city: string;
  state: string;
  shipping_charge: number;
  cod_available: boolean;
  estimated_days: number;
  is_active: boolean;
}) {
  const pincode = input.pincode.replace(/\s+/g, '').trim();
  const dup = await query<any[]>('SELECT id FROM serviceable_pincodes WHERE pincode = :p LIMIT 1', { p: pincode });
  if (dup.length) throw new ApiError(409, 'Pincode already exists');
  const res = await execute(
    `INSERT INTO serviceable_pincodes (pincode, city, state, shipping_charge, cod_available, estimated_days, is_active)
     VALUES (:pincode, :city, :state, :shipping, :cod, :days, :active)`,
    {
      pincode,
      city: input.city,
      state: input.state,
      shipping: input.shipping_charge,
      cod: input.cod_available ? 1 : 0,
      days: input.estimated_days,
      active: input.is_active ? 1 : 0
    }
  );
  return Number(res.insertId);
}

export async function adminUpdatePincode(
  id: number,
  input: {
    pincode: string;
    city: string;
    state: string;
    shipping_charge: number;
    cod_available: boolean;
    estimated_days: number;
    is_active: boolean;
  }
) {
  const pincode = input.pincode.replace(/\s+/g, '').trim();
  const dup = await query<any[]>(
    'SELECT id FROM serviceable_pincodes WHERE pincode = :p AND id <> :id LIMIT 1',
    { p: pincode, id }
  );
  if (dup.length) throw new ApiError(409, 'Pincode already in use');
  const res = await execute(
    `UPDATE serviceable_pincodes SET
      pincode = :pincode, city = :city, state = :state, shipping_charge = :shipping,
      cod_available = :cod, estimated_days = :days, is_active = :active, updated_at = CURRENT_TIMESTAMP
     WHERE id = :id`,
    {
      id,
      pincode,
      city: input.city,
      state: input.state,
      shipping: input.shipping_charge,
      cod: input.cod_available ? 1 : 0,
      days: input.estimated_days,
      active: input.is_active ? 1 : 0
    }
  );
  if (!res.affectedRows) throw new ApiError(404, 'Pincode row not found');
}

export async function adminDeletePincode(id: number) {
  const res = await execute('DELETE FROM serviceable_pincodes WHERE id = :id', { id });
  if (!res.affectedRows) throw new ApiError(404, 'Pincode row not found');
}
