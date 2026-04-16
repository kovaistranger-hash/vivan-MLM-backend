import { Request, Response } from 'express';
import { createComplaint } from './complaint.service.js';

export async function postComplaint(req: Request, res: Response) {
  const uid = req.user!.id;
  const { message } = req.body as { message: string };
  const row = await createComplaint(uid, message);
  res.status(201).json({ success: true, complaint: row });
}
