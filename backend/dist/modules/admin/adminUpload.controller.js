import { ApiError } from '../../utils/ApiError.js';
import { initCloudinaryFromEnv, isCloudinaryConfigured, uploadImageBuffer } from '../upload/cloudinary.service.js';
export async function adminUploadImage(req, res) {
    initCloudinaryFromEnv();
    if (!isCloudinaryConfigured()) {
        throw new ApiError(503, 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
    }
    const file = req.file;
    if (!file?.buffer)
        throw new ApiError(400, 'No file uploaded (use multipart field name: file)');
    if (!file.mimetype.startsWith('image/'))
        throw new ApiError(400, 'Only image uploads are allowed');
    const folder = req.body?.folder || 'vivan/products';
    const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, '').slice(0, 80) || 'vivan/products';
    const result = await uploadImageBuffer(file.buffer, safeFolder);
    res.status(201).json({ success: true, url: result.url, publicId: result.publicId });
}
