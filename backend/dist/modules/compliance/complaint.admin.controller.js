import { adminListComplaints, adminUpdateComplaintStatus } from './complaint.service.js';
export async function adminComplaintsList(req, res) {
    const q = req.validatedQuery;
    const data = await adminListComplaints({
        status: q.status,
        page: q.page,
        pageSize: q.pageSize
    });
    res.json({
        success: true,
        complaints: data.items,
        pagination: {
            page: q.page,
            pageSize: q.pageSize,
            total: data.total,
            totalPages: Math.max(1, Math.ceil(data.total / q.pageSize))
        }
    });
}
export async function adminComplaintPatch(req, res) {
    const id = Number(req.params.id);
    const { status } = req.body;
    const row = await adminUpdateComplaintStatus(id, status);
    res.json({ success: true, complaint: row });
}
