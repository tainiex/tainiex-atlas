import {
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Body,
  Query,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { StorageService } from './storage.service';
import {
  IFileUploadResponse,
  ISignedUrlResponse,
  UploadFileQueryDto,
  GetSignedUrlQueryDto,
} from '@tainiex/shared-atlas';
import { LoggerService } from '../logger/logger.service';

/**
 * StorageController
 * 存储控制器
 *
 * Handles generic file uploads.
 * 处理通用文件上传。
 */
@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StorageController.name);
  }

  /**
   * Upload a file.
   * 上传文件。
   *
   * POST /storage/upload
   * Query params:
   * - module: Optional module prefix (e.g., 'notes', 'chat') / 可选模块前缀（例如 'notes', 'chat'）
   * - folder: Optional target folder (default: 'uploads') / 可选目标文件夹（默认：'uploads'）
   */
  @Post('upload')
  async uploadFile(
    @Req() req: FastifyRequest,
    @Query() query: UploadFileQueryDto,
  ): Promise<IFileUploadResponse> {
    const file = await req.file();
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    const buffer = await file.toBuffer();

    try {
      // Construct folder path with module prefix / 使用模块前缀构建文件夹路径
      const folder = query.folder || 'uploads';
      const finalFolder = query.module ? `${query.module}/${folder}` : folder;

      // Upload to storage / 上传到存储
      const gcsPath = await this.storageService.uploadFile(
        buffer,
        file.filename,
        finalFolder,
        file.mimetype,
      );

      // Generate signed URL / 生成签名 URL
      const expirationMinutes = 60;
      const signedUrl = await this.storageService.getSignedUrl(
        gcsPath,
        expirationMinutes,
      ); // 60 minutes / 60 分钟
      const expiresAt = Date.now() + expirationMinutes * 60 * 1000;

      // Get file metadata / 获取文件元数据
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const metadata = await this.storageService.getFileMetadata(gcsPath);

      return {
        success: true,
        url: signedUrl,
        path: gcsPath,
        expiresAt,

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: {
          filename: file.filename,
          size: buffer.length,
          contentType: file.mimetype,

          ...metadata,
        },
      };
    } catch (error: any) {
      this.logger.error('[StorageController] Upload failed:', error);
      throw new HttpException(
        'File upload failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a signed URL for an existing file.
   * 获取现有文件的签名 URL。
   *
   * GET /storage/url
   * Query params:
   * - path: GCS file path / GCS 文件路径
   * - expirationSeconds: Optional validity duration (60-86400) / 可选有效时长 (60-86400)
   */
  @Get('url')
  async getSignedUrl(
    @Query() query: GetSignedUrlQueryDto,
  ): Promise<ISignedUrlResponse> {
    try {
      // Determine expiration (default 60 mins -> 3600 seconds)
      // 确定过期时间（默认 60 分钟 -> 3600 秒）
      const expirationSeconds = query.expirationSeconds || 3600;
      const expirationMinutes = Math.ceil(expirationSeconds / 60);

      // Generate URL
      // 生成 URL
      const url = await this.storageService.getSignedUrl(
        query.path,
        expirationMinutes,
      );

      if (!url) {
        throw new HttpException(
          'File not found or processing failed',
          HttpStatus.NOT_FOUND,
        );
      }

      // Calculate precise expiration timestamp
      // 计算精确的过期时间戳
      const now = Date.now();
      const expiresAt = now + expirationSeconds * 1000;

      return {
        url,
        path: query.path,
        expiresAt,
        expiresIn: expirationSeconds,
      };
    } catch (error) {
      this.logger.error('[StorageController] GetSignedUrl failed:', error);
      throw new HttpException(
        'Failed to generate signed URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
