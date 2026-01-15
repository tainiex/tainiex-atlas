import {
    Controller,
    Post,
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
import { IFileUploadResponse, UploadFileQueryDto } from '@tainiex/shared-atlas';

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
    constructor(private readonly storageService: StorageService) { }

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
                file.mimetype
            );

            // Generate signed URL / 生成签名 URL
            const signedUrl = await this.storageService.getSignedUrl(gcsPath, 60); // 60 minutes / 60 分钟

            // Get file metadata / 获取文件元数据
            const metadata = await this.storageService.getFileMetadata(gcsPath);

            return {
                success: true,
                url: signedUrl,
                path: gcsPath,
                metadata: {
                    filename: file.filename,
                    size: buffer.length,
                    contentType: file.mimetype,
                    ...metadata,
                },
            };
        } catch (error: any) {
            console.error('[StorageController] Upload failed:', error);
            throw new HttpException(
                'File upload failed',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
