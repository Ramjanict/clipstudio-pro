import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Inject,
  forwardRef,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ExportService } from './export.service';
import { RenderingService } from '../rendering/rendering.service';
import { CloudinaryService } from '../common/cloudinary.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly cloudinaryService: CloudinaryService,
    @Inject(forwardRef(() => RenderingService))
    private readonly renderingService: RenderingService,
  ) {}

  @Get('my-exports')
  async getMyExports(@Req() req: any) {
    const userId = req.user?.id;
    return await this.exportService.findUserExports(userId);
  }

  @Post()
  async exportVideo(
    @Body('sceneGraph') sceneGraph: any,
    @Req() req: any,
    @Res() res: express.Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const host = req.headers['x-forwarded-host'] || req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const requestOrigin = `${protocol}://${host}`;
    const userId = req.user?.id;

    try {
      await this.exportService.export(sceneGraph, res, requestOrigin, userId);
    } catch (error: any) {
      console.error('Export initiation error:', error);
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: error.message || 'Failed to start export rendering',
        })}\n\n`,
      );
      res.end();
    }
  }

  @Post('browser-upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5000 * 1024 * 1024 },
      storage: diskStorage({
        destination: (req, file, cb) => {
          const tempDir = join(os.tmpdir(), 'clipstudio-browser-exports');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          cb(null, tempDir);
        },
        filename: (req, file, cb) => {
          const unique = `browser_export_${Date.now()}${extname(file.originalname || '.mp4')}`;
          cb(null, unique);
        },
      }),
    }),
  )
  async uploadBrowserExport(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No video export uploaded');
    }

    const userId = req.user?.id;

    try {
      // Upload browser-rendered video directly to Cloudinary
      const cResult = await this.cloudinaryService.uploadFile(file.path, {
        folder: userId ? `clipstudio/exports/${userId}` : 'clipstudio/exports',
        resourceType: 'video',
      });

      // Cleanup local temp file
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch {}

      // Save to database
      await this.exportService.createExportAsset(cResult.secure_url, userId, cResult.public_id);

      return {
        url: cResult.secure_url,
        public_id: cResult.public_id,
      };
    } catch (err: any) {
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch {}
      throw new BadRequestException(err?.message || 'Failed to upload export to Cloudinary');
    }
  }
}
