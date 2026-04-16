import fs from 'node:fs';
import path from 'node:path';
import { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { buildInvoicePdf, loadOrderForInvoice } from './invoice.service.js';
import { ApiError } from '../../utils/ApiError.js';

export async function downloadOrderInvoice(req: Request, res: Response) {
  const orderId = Number(req.params.id);
  const data = await loadOrderForInvoice(orderId);
  if (!data) throw new ApiError(404, 'Order not found');

  const isAdmin = req.user!.role === 'admin';
  if (!isAdmin && data.order.user_id !== req.user!.id) {
    throw new ApiError(403, 'Not allowed to view this invoice');
  }

  const filename = `${data.order.invoice_number || data.order.order_number}.pdf`;
  const stored = typeof data.order.invoice_url === 'string' ? data.order.invoice_url.trim() : '';
  if (stored.startsWith('/uploads/invoices/')) {
    const rel = stored.replace(/^\/uploads\//, '');
    const abs = path.resolve(process.cwd(), env.uploadDir, rel);
    if (fs.existsSync(abs)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(fs.readFileSync(abs));
      return;
    }
  }

  const pdf = await buildInvoicePdf(data.order, data.items);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdf);
}
