import { Request, Response } from 'express';
import { adminCreateBanner, adminDeleteBanner, adminListBanners, adminUpdateBanner } from './adminBanner.service.js';

export async function adminBannersList(_req: Request, res: Response) {
  const banners = await adminListBanners();
  res.json({ success: true, banners });
}

export async function adminBannerCreate(req: Request, res: Response) {
  const body = req.body as {
    title: string;
    subtitle?: string | null;
    image_url: string;
    link_url?: string | null;
    sort_order: number;
    is_active: boolean;
  };
  const id = await adminCreateBanner({
    ...body,
    subtitle: body.subtitle || null,
    link_url: body.link_url || null
  });
  res.status(201).json({ success: true, id });
}

export async function adminBannerUpdate(req: Request, res: Response) {
  const id = Number(req.params.id);
  const body = req.body as {
    title: string;
    subtitle?: string | null;
    image_url: string;
    link_url?: string | null;
    sort_order: number;
    is_active: boolean;
  };
  await adminUpdateBanner(id, {
    ...body,
    subtitle: body.subtitle || null,
    link_url: body.link_url || null
  });
  res.json({ success: true });
}

export async function adminBannerDelete(req: Request, res: Response) {
  await adminDeleteBanner(Number(req.params.id));
  res.json({ success: true });
}
