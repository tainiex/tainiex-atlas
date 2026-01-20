import {
  Controller,
  Post,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Param,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from '../common/storage/storage.service';
import { BlocksService } from './blocks.service';
import { NotesService } from './notes.service';

/**
 * Accepted MIME types for different file categories.
 * 不同文件类别接受的MIME类型。
 */
const ACCEPTED_MIME_TYPES = {
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  file: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
  ],
};

/**
 * File size limits (in bytes).
 * 文件大小限制（字节）。
 */
const SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  video: 100 * 1024 * 1024, // 100MB
  file: 50 * 1024 * 1024, // 50MB
};

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

interface RequestWithUser extends FastifyRequest {
  user: {
    id: string;
  };
}

/**
 * UploadController - handles file uploads for notes.
 * UploadController - 处理笔记的文件上传。
 */
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly storageService: StorageService,
    private readonly blocksService: BlocksService,
    private readonly notesService: NotesService,
  ) {}

  /**
   * Upload an image for a note.
   * POST /api/upload/image/:noteId
   */
  @Post('image/:noteId')
  async uploadImage(
    @Req() req: RequestWithUser,
    @Param('noteId') noteId: string,
  ) {
    const file = await req.file();
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    const buffer = await file.toBuffer();
    const mappedFile: UploadedFile = {
      buffer,
      originalname: file.filename,
      mimetype: file.mimetype,
      size: buffer.length,
    };
    return this.handleUpload(req.user.id, noteId, mappedFile, 'image');
  }

  /**
   * Upload a video for a note.
   * POST /api/upload/video/:noteId
   */
  @Post('video/:noteId')
  async uploadVideo(
    @Req() req: RequestWithUser,
    @Param('noteId') noteId: string,
  ) {
    const file = await req.file();
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    const buffer = await file.toBuffer();
    const mappedFile: UploadedFile = {
      buffer,
      originalname: file.filename,
      mimetype: file.mimetype,
      size: buffer.length,
    };
    return this.handleUpload(req.user.id, noteId, mappedFile, 'video');
  }

  /**
   * Upload a file attachment for a note.
   * POST /api/upload/file/:noteId
   */
  @Post('file/:noteId')
  async uploadFile(
    @Req() req: RequestWithUser,
    @Param('noteId') noteId: string,
  ) {
    const file = await req.file();
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    const buffer = await file.toBuffer();
    const mappedFile: UploadedFile = {
      buffer,
      originalname: file.filename,
      mimetype: file.mimetype,
      size: buffer.length,
    };
    return this.handleUpload(req.user.id, noteId, mappedFile, 'file');
  }

  /**
   * Common upload handler.
   * 通用上传处理器。
   */
  private async handleUpload(
    userId: string,
    noteId: string,
    file: UploadedFile,
    type: keyof typeof ACCEPTED_MIME_TYPES,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    // Validate MIME type
    if (!ACCEPTED_MIME_TYPES[type].includes(file.mimetype)) {
      throw new HttpException(
        `Invalid file type. Accepted types: ${ACCEPTED_MIME_TYPES[type].join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate file size
    if (file.size > SIZE_LIMITS[type]) {
      throw new HttpException(
        `File too large. Maximum size: ${SIZE_LIMITS[type] / (1024 * 1024)}MB`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if user can edit this note
    const canEdit = await this.notesService.canEdit(noteId, userId);
    if (!canEdit) {
      throw new HttpException('Cannot edit this note', HttpStatus.FORBIDDEN);
    }

    try {
      // Upload to GCS
      const folder = `notes/${type}s`; // 'notes/images', 'notes/videos', 'notes/files'
      const gcsPath = await this.storageService.uploadFile(
        file.buffer,
        file.originalname,
        folder,
        file.mimetype,
      );

      // Generate signed URL
      const expirationMinutes = 60;
      const signedUrl = await this.storageService.getSignedUrl(
        gcsPath,
        expirationMinutes,
      ); // 60 minutes
      const expiresAt = Date.now() + expirationMinutes * 60 * 1000;

      // Get file metadata
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const metadata = await this.storageService.getFileMetadata(gcsPath);

      return {
        success: true,
        url: signedUrl,
        path: gcsPath, // Return 'path' to match IFileUploadResponse
        gcsPath, // Keep 'gcsPath' for backward compatibility if any
        expiresAt,

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: {
          filename: file.originalname,
          size: file.size,
          contentType: file.mimetype,

          ...metadata,
        },
      };
    } catch (error) {
      console.error('[UploadController] Upload failed:', error);
      throw new HttpException(
        'File upload failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
