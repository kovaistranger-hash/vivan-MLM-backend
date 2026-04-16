import { Request, Response } from 'express';
import { adminListComplaints, adminUpdateComplaintStatus } from './complaint.service.js';

export async function adminComplaintsList(req: Request, res: Response) {
  const q = (req as any).validatedQuery as { status?: 'open' | 'resolved'; page: number; pageSize: number };
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

export async function adminComplaintPatch(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { status } = req.body as { status: 'open' | 'resolved' };
  const row = await adminUpdateComplaintStatus(id, status);
  res.json({ success: true, complaint: row });
}
