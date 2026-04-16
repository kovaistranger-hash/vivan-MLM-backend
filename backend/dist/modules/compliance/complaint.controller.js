import { createComplaint } from './complaint.service.js';
export async function postComplaint(req, res) {
    const uid = req.user.id;
    const { message } = req.body;
    const row = await createComplaint(uid, message);
    res.status(201).json({ success: true, complaint: row });
}
