import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary.service';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { configureFfmpeg } from '../common/ffmpeg.util';

export interface CreateAssetInput {
  original_url: string;
  preview_url?: string;
  thumbnail_sprite_url?: string;
  duration?: number;
  type?: string;
  public_id?: string;
  userId: string;
}

@Injectable()
export class AssetService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  private mapAsset(asset: any) {
    if (!asset) return null;
    const { id, ...rest } = asset;
    return { _id: id, ...rest };
  }

  async create(data: CreateAssetInput) {
    if (!data.userId) {
      throw new UnauthorizedException('User authentication is required to create an asset');
    }

    const asset = await this.prisma.asset.create({
      data: {
        original_url: data.original_url,
        preview_url: data.preview_url || data.original_url,
        thumbnail_sprite_url: data.thumbnail_sprite_url,
        duration: data.duration,
        type: data.type || 'video',
        public_id: data.public_id,
        userId: data.userId,
      },
    });
    return this.mapAsset(asset);
  }

  async findAll(userId?: string) {
    if (!userId) {
      return [];
    }
    const assets = await this.prisma.asset.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return assets.map((asset) => this.mapAsset(asset));
  }

  async delete(id: string, userId?: string) {
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const existing = await this.prisma.asset.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Asset not found or you do not have permission to delete it');
    }

    // 1. Delete from Cloudinary if public_id exists
    if (existing.public_id && !existing.public_id.includes('.')) {
      const resourceType = existing.type === 'image' ? 'image' : 'video';
      try {
        await this.cloudinaryService.deleteFile(existing.public_id, resourceType);
      } catch (cErr) {
        console.warn(`Could not delete asset ${existing.public_id} from Cloudinary:`, cErr);
      }
    }

    // 2. Attempt fallback cleanup if local file exists
    try {
      if (existing.original_url && existing.original_url.includes('/uploads/')) {
        const rel = existing.original_url.split('/uploads/').pop()?.split('?')[0];
        if (rel) {
          const parts = rel.split('/').filter(Boolean);
          const filePath = path.join(process.cwd(), 'uploads', ...parts);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (err) {
      console.warn('Could not delete physical asset file:', err);
    }

    const asset = await this.prisma.asset.delete({
      where: { id },
    });

    return this.mapAsset(asset);
  }

  /**
   * Generates a lightweight 480p preview proxy with faststart flags if local encoding is needed.
   */
  async generateVideoProxy(inputPath: string, outputPath: string): Promise<boolean> {
    configureFfmpeg();
    return new Promise((resolve) => {
      try {
        ffmpeg(inputPath)
          .outputOptions([
            '-vf', "scale='min(854,iw)':-2",
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '26',
            '-g', '15',
            '-keyint_min', '15',
            '-sc_threshold', '0',
            '-c:a', 'aac',
            '-b:a', '96k',
            '-movflags', '+faststart',
          ])
          .output(outputPath)
          .on('end', () => {
            console.log(`[Proxy] Generated 480p preview proxy: ${outputPath}`);
            resolve(true);
          })
          .on('error', (err: any) => {
            console.warn(`[Proxy] Failed to generate preview for ${inputPath}:`, err?.message || err);
            resolve(false);
          })
          .run();
      } catch (err: any) {
        console.warn(`[Proxy] Exception starting proxy generation for ${inputPath}:`, err?.message || err);
        resolve(false);
      }
    });
  }

  async updatePreviewUrl(assetId: string, previewUrl: string): Promise<void> {
    try {
      await this.prisma.asset.update({
        where: { id: assetId },
        data: { preview_url: previewUrl },
      });
    } catch (err) {
      console.warn(`Failed to update preview_url for asset ${assetId}:`, err);
    }
  }
}
