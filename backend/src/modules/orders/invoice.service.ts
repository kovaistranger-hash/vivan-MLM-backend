import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { env } from '../../config/env.js';
import { query } from '../../db/mysql.js';
import { getOrderItems } from './order.read.service.js';

export async function loadOrderForInvoice(orderId: number) {
  const rows = await query<any[]>(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email
     FROM orders o
     INNER JOIN users u ON u.id = o.user_id
     WHERE o.id = :id LIMIT 1`,
    { id: orderId }
  );
  const order = rows[0];
  if (!order) return null;
  const items = await getOrderItems(orderId);
  return { order, items };
}

export function buildInvoicePdf(order: any, items: any[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const inv = order.invoice_number || `ORDER-${order.order_number}`;

    doc.fillColor('#0f172a').fontSize(22).text('Vivan');
    doc.moveDown(0.25);
    doc.fontSize(11).fillColor('#64748b').text('Tax invoice');
    doc.moveDown(0.75);
    doc.fillColor('#0f172a').fontSize(11).text(`Invoice: ${inv}`);
    doc.fontSize(10).fillColor('#334155').text(`Order: ${order.order_number}`);
    doc.moveDown();
    doc.fontSize(10).fillColor('#334155');
    doc.text(`Date: ${new Date(order.created_at).toLocaleString('en-IN')}`);
    doc.moveDown(0.5);
    doc.text(`Bill to: ${order.customer_name}`);
    doc.text(order.customer_email);
    doc.text(`Phone: ${order.shipping_phone}`);
    doc.moveDown();
    doc.fontSize(11).fillColor('#0f172a').text('Shipping address');
    doc.fontSize(10).fillColor('#334155');
    doc.text(`${order.shipping_name}`);
    doc.text(`${order.shipping_address1}`);
    if (order.shipping_address2) doc.text(`${order.shipping_address2}`);
    doc.text(`${order.shipping_city}, ${order.shipping_state} ${order.shipping_pincode}`);
    if (order.customer_gstin) doc.text(`GSTIN: ${order.customer_gstin}`);
    doc.moveDown();

    const tableTop = doc.y;
    doc.fontSize(10).fillColor('#0f172a');
    doc.text('Item', 48, tableTop, { width: 220 });
    doc.text('Qty', 280, tableTop, { width: 40 });
    doc.text('Rate', 330, tableTop, { width: 70, align: 'right' });
    doc.text('GST%', 410, tableTop, { width: 40, align: 'right' });
    doc.text('Line', 460, tableTop, { width: 80, align: 'right' });
    doc.moveTo(48, tableTop + 14).lineTo(540, tableTop + 14).stroke('#e2e8f0');

    let y = tableTop + 22;
    for (const it of items) {
      doc.fillColor('#334155').fontSize(9);
      doc.text(it.product_name, 48, y, { width: 220 });
      doc.text(String(it.quantity), 280, y, { width: 40 });
      doc.text(`₹${Number(it.unit_price).toFixed(2)}`, 330, y, { width: 70, align: 'right' });
      doc.text(`${Number(it.gst_rate).toFixed(0)}%`, 410, y, { width: 40, align: 'right' });
      doc.text(`₹${Number(it.line_total).toFixed(2)}`, 460, y, { width: 80, align: 'right' });
      y += 18;
      if (y > 720) {
        doc.addPage();
        y = 48;
      }
    }

    doc.moveDown(2);
    y = doc.y;
    doc.fontSize(10).fillColor('#334155');
    doc.text(`Merchandise subtotal`, 350, y, { width: 100, align: 'right' });
    doc.text(`₹${Number(order.subtotal).toFixed(2)}`, 460, y, { width: 80, align: 'right' });
    y += 16;
    doc.text(`GST`, 350, y, { width: 100, align: 'right' });
    doc.text(`₹${Number(order.gst_amount).toFixed(2)}`, 460, y, { width: 80, align: 'right' });
    y += 16;
    doc.text(`CGST / SGST (split)`, 350, y, { width: 100, align: 'right' });
    doc.text(`₹${Number(order.cgst_amount).toFixed(2)} / ₹${Number(order.sgst_amount).toFixed(2)}`, 460, y, { width: 80, align: 'right' });
    y += 16;
    doc.text(`Shipping`, 350, y, { width: 100, align: 'right' });
    doc.text(`₹${Number(order.shipping_amount).toFixed(2)}`, 460, y, { width: 80, align: 'right' });
    y += 18;
    const walletUsed = Number(order.wallet_amount || 0);
    if (walletUsed > 0) {
      doc.fontSize(10).fillColor('#334155').text(`Wallet applied`, 350, y, { width: 100, align: 'right' });
      doc.text(`−₹${walletUsed.toFixed(2)}`, 460, y, { width: 80, align: 'right' });
      y += 18;
    }
    doc.fontSize(12).fillColor('#0f172a').text(`Total`, 350, y, { width: 100, align: 'right' });
    doc.text(`₹${Number(order.total_amount).toFixed(2)}`, 460, y, { width: 80, align: 'right' });

    doc.moveDown(3);
    doc.fontSize(8).fillColor('#94a3b8').text('This is a computer-generated document for Vivan.', { align: 'center' });

    doc.end();
  });
}

/** Writes tax invoice PDF to disk and sets `orders.invoice_url` (served under `/uploads`). */
export async function persistOrderInvoiceToDisk(orderId: number): Promise<string | null> {
  const data = await loadOrderForInvoice(orderId);
  if (!data) return null;
  const buf = await buildInvoicePdf(data.order, data.items);
  const dir = path.resolve(process.cwd(), env.uploadDir, 'invoices');
  fs.mkdirSync(dir, { recursive: true });
  const rel = `/uploads/invoices/${orderId}.pdf`;
  fs.writeFileSync(path.join(dir, `${orderId}.pdf`), buf);
  await query(`UPDATE orders SET invoice_url = :url WHERE id = :id`, { url: rel, id: orderId });
  return rel;
}
