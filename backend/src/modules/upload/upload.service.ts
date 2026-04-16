import type { ImageUploader, UploadResult } from './upload.types.js';

/** Local disk uploads (placeholder for future multipart). */
class LocalUploader implements ImageUploader {
  async uploadFromBuffer(_buffer: Buffer, filename: string): Promise<UploadResult> {
    return { url: `/uploads/${filename}`, provider: 'local' };
  }
}

/** Stub: wire @cloudinary/url-gen or SDK here later. */
class CloudinaryUploaderStub implements ImageUploader {
  async uploadFromBuffer(_buffer: Buffer, _filename: string): Promise<UploadResult> {
    throw new Error('Cloudinary uploader not configured — set image_url on entities for now.');
  }
}

let uploader: ImageUploader = new LocalUploader();

export function getUploader(): ImageUploader {
  return uploader;
}

export function setUploaderForTests(mock: ImageUploader) {
  uploader = mock;
}

export function createUploaderFromEnv(): ImageUploader {
  if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
    return new CloudinaryUploaderStub();
  }
  return new LocalUploader();
}
