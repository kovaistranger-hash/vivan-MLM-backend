/** Local disk uploads (placeholder for future multipart). */
class LocalUploader {
    async uploadFromBuffer(_buffer, filename) {
        return { url: `/uploads/${filename}`, provider: 'local' };
    }
}
/** Stub: wire @cloudinary/url-gen or SDK here later. */
class CloudinaryUploaderStub {
    async uploadFromBuffer(_buffer, _filename) {
        throw new Error('Cloudinary uploader not configured — set image_url on entities for now.');
    }
}
let uploader = new LocalUploader();
export function getUploader() {
    return uploader;
}
export function setUploaderForTests(mock) {
    uploader = mock;
}
export function createUploaderFromEnv() {
    if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
        return new CloudinaryUploaderStub();
    }
    return new LocalUploader();
}
