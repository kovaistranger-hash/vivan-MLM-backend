import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';

let configured = false;

export function initCloudinaryFromEnv() {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    configured = false;
    return;
  }
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret
  });
  configured = true;
}

export function isCloudinaryConfigured() {
  return configured;
}

export async function uploadImageBuffer(buffer: Buffer, folder = 'vivan/products'): Promise<{ url: string; publicId: string }> {
  if (!configured) throw new Error('Cloudinary is not configured');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (err, result) => {
      if (err || !result?.secure_url) {
        reject(err || new Error('Upload failed'));
        return;
      }
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}
