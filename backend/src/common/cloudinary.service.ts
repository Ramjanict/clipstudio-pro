import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  duration?: number;
  resource_type: string;
  format?: string;
  width?: number;
  height?: number;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dmeg0t89b';
    const apiKey = process.env.CLOUDINARY_API_KEY || '547359116116553';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'xH1S1jcP117x0yhEnS5fDpJlrLQ';

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    this.logger.log(`Cloudinary configured for cloud_name: ${cloudName}`);
  }

  /**
   * Upload a local file from disk to Cloudinary.
   */
  async uploadFile(
    filePath: string,
    options: {
      folder?: string;
      resourceType?: 'video' | 'image' | 'raw' | 'auto';
      publicId?: string;
    } = {},
  ): Promise<CloudinaryUploadResult> {
    try {
      const result: UploadApiResponse = await cloudinary.uploader.upload(filePath, {
        folder: options.folder || 'clipstudio/assets',
        resource_type: options.resourceType || 'auto',
        public_id: options.publicId,
        overwrite: true,
      });

      return {
        secure_url: result.secure_url,
        public_id: result.public_id,
        duration: result.duration ? Number(result.duration) : undefined,
        resource_type: result.resource_type,
        format: result.format,
        width: result.width,
        height: result.height,
      };
    } catch (err: any) {
      this.logger.error(`Cloudinary uploadFile failed: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Upload an in-memory Buffer or stream to Cloudinary.
   */
  async uploadBuffer(
    buffer: Buffer,
    options: {
      folder?: string;
      resourceType?: 'video' | 'image' | 'raw' | 'auto';
      publicId?: string;
      filename?: string;
    } = {},
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || 'clipstudio/assets',
          resource_type: options.resourceType || 'auto',
          public_id: options.publicId,
          filename_override: options.filename,
          overwrite: true,
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(`Cloudinary uploadBuffer failed: ${error?.message || 'Unknown error'}`);
            return reject(error || new Error('Upload to Cloudinary failed'));
          }

          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
            duration: result.duration ? Number(result.duration) : undefined,
            resource_type: result.resource_type,
            format: result.format,
            width: result.width,
            height: result.height,
          });
        },
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }

  /**
   * Delete a media asset from Cloudinary by its public_id.
   */
  async deleteFile(
    publicId: string,
    resourceType: 'video' | 'image' | 'raw' = 'video',
  ): Promise<boolean> {
    try {
      const res = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });
      return res.result === 'ok';
    } catch (err: any) {
      this.logger.warn(`Cloudinary deleteFile warning for ${publicId}: ${err.message}`);
      return false;
    }
  }
}
