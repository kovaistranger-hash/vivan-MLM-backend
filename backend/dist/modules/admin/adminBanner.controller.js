import { adminCreateBanner, adminDeleteBanner, adminListBanners, adminUpdateBanner } from './adminBanner.service.js';
export async function adminBannersList(_req, res) {
    const banners = await adminListBanners();
    res.json({ success: true, banners });
}
export async function adminBannerCreate(req, res) {
    const body = req.body;
    const id = await adminCreateBanner({
        ...body,
        subtitle: body.subtitle || null,
        link_url: body.link_url || null
    });
    res.status(201).json({ success: true, id });
}
export async function adminBannerUpdate(req, res) {
    const id = Number(req.params.id);
    const body = req.body;
    await adminUpdateBanner(id, {
        ...body,
        subtitle: body.subtitle || null,
        link_url: body.link_url || null
    });
    res.json({ success: true });
}
export async function adminBannerDelete(req, res) {
    await adminDeleteBanner(Number(req.params.id));
    res.json({ success: true });
}
