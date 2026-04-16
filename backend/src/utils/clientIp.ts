import type { Request } from 'express';

/** Best-effort client IP for fraud / rate hints (honor X-Forwarded-For when present). */
export function getClientIp(req: Request): string | null {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') {
    const first = xf.split(',')[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const raw = req.socket?.remoteAddress || '';
  const s = String(raw).replace(/^::ffff:/, '');
  return s ? s.slice(0, 45) : null;
}
