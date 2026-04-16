/**
 * Upload abstraction — swap implementation for Cloudinary later.
 */
export type UploadResult = {
  url: string;
  provider: 'local' | 'cloudinary' | 'noop';
};

export interface ImageUploader {
  /** Reserved for future multipart uploads; Phase 2 uses image_url text only. */
  uploadFromBuffer?(_buffer: Buffer, _filename: string): Promise<UploadResult>;
}
