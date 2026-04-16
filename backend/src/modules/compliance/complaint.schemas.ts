import { z } from 'zod';

export const complaintCreateSchema = z.object({
  message: z.string().trim().min(10).max(8000)
});

export const adminComplaintListQuerySchema = z.object({
  status: z.enum(['open', 'resolved']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const adminComplaintPatchSchema = z.object({
  status: z.enum(['open', 'resolved'])
});
