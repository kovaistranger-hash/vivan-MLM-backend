import { adminCreatePincode, adminDeletePincode, adminListPincodes, adminUpdatePincode } from './adminPincode.service.js';
export async function adminPincodesList(_req, res) {
    const rows = await adminListPincodes();
    res.json({ success: true, pincodes: rows });
}
export async function adminPincodeCreate(req, res) {
    const id = await adminCreatePincode(req.body);
    res.status(201).json({ success: true, id });
}
export async function adminPincodeUpdate(req, res) {
    await adminUpdatePincode(Number(req.params.id), req.body);
    res.json({ success: true });
}
export async function adminPincodeDelete(req, res) {
    await adminDeletePincode(Number(req.params.id));
    res.json({ success: true });
}
