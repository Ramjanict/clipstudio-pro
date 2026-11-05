import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as os from 'os';
import { AssetService } from './asset.service';
import { CloudinaryService } from '../common/cloudinary.service';
import { probeDuration } from '../common/ffmpeg.util';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetController {
  constructor(
    private readonly assetService: AssetService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('video', {
      limits: { fileSize: 5000 * 1024 * 1024 },
      storage: diskStorage({
        destination: (req: any, file, cb) => {
          const tempUploadDir = join(os.tmpdir(), 'clipstudio-uploads');
          if (!fs.existsSync(tempUploadDir)) {
            fs.mkdirSync(tempUploadDir, { recursive: true });
          }
          cb(null, tempUploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          let ext = extname(file.originalname || '').toLowerCase();
          if (!ext) {
            if (file.mimetype?.includes('png')) ext = '.png';
            else if (file.mimetype?.includes('jpeg') || file.mimetype?.includes('jpg')) ext = '.jpg';
            else if (file.mimetype?.includes('gif')) ext = '.gif';
            else if (file.mimetype?.includes('webp')) ext = '.webp';
            else if (file.mimetype?.includes('mp4')) ext = '.mp4';
            else if (file.mimetype?.includes('webm')) ext = '.webm';
            else if (file.mimetype?.includes('ogg')) ext = '.ogg';
            else if (file.mimetype?.includes('mp3') || file.mimetype?.includes('mpeg')) ext = '.mp3';
            else if (file.mimetype?.includes('wav')) ext = '.wav';
            else ext = '.mp4';
          }
          cb(null, uniqueSuffix + ext);
        },
      }),
    }),
  )
  async uploadAsset(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const ext = extname(file.originalname || file.filename).toLowerCase();
    let type = 'video';
    if (
      file.mimetype.startsWith('image/') ||
      ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico'].includes(ext)
    ) {
      type = 'image';
    } else if (
      file.mimetype.startsWith('audio/') ||
      ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)
    ) {
      type = 'audio';
    } else {
      type = 'video';
    }

    let assetDuration = req.body?.duration ? parseFloat(req.body.duration) : 0;
    if (!assetDuration || isNaN(assetDuration) || assetDuration <= 0) {
      if (type === 'video' || type === 'audio') {
        try {
          assetDuration = await probeDuration(file.path);
        } catch (err) {
          console.error('Probe duration error:', err);
        }
      }
    }
    if (!assetDuration || isNaN(assetDuration) || assetDuration <= 0) {
      assetDuration = type === 'image' ? 5 : 10;
    }

    const userId = req.user.id;

    try {
      // 1. Upload directly to Cloudinary (no local VPS disk dependency!)
      const resourceType = type === 'image' ? 'image' : 'video';
      const cResult = await this.cloudinaryService.uploadFile(file.path, {
        folder: `clipstudio/${userId}`,
        resourceType,
      });

      // 2. Clean up temporary local upload file from temp disk
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanErr) {
        console.warn('Could not remove temporary local file:', cleanErr);
      }

      // 3. Save to database with Cloudinary permanent URL
      const createdAsset = await this.assetService.create({
        original_url: cResult.secure_url,
        preview_url: cResult.secure_url,
        duration: cResult.duration || assetDuration,
        type: type,
        public_id: cResult.public_id,
        userId,
      });

      return createdAsset;
    } catch (error: any) {
      console.error('Upload to Cloudinary / DB save error:', error);
      // Clean up temp file on error
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch {}
      throw new InternalServerErrorException(error?.message || 'Failed to upload asset to Cloudinary');
    }
  }

  @Get()
  async getAllAssets(@Req() req: any) {
    const userId = req.user.id;
    return await this.assetService.findAll(userId);
  }

  @Delete(':id')
  async deleteAsset(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return await this.assetService.delete(id, userId);
  }
}

@Controller('download')
export class DownloadController {
  @Get(':userId/:filename')
  downloadUserFile(
    @Param('userId') userId: string,
    @Param('filename') filename: string,
    @Res() res: express.Response,
  ) {
    const filePath = join(process.cwd(), 'uploads', userId, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    return res.download(filePath, filename);
  }

  @Get(':filename')
  downloadFile(@Param('filename') filename: string, @Res() res: express.Response) {
    const filePath = join(process.cwd(), 'uploads', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    return res.download(filePath, filename);
  }
}
