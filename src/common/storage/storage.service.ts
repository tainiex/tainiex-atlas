import { Injectable, Inject } from '@nestjs/common';
import type { StorageStrategy } from './storage.strategy.interface';

/**
 * StorageService - Handles file uploads to Google Cloud Storage.
 * StorageService - 处理文件上传到Google Cloud Storage。
 *
 * Provides unified file upload and signed URL generation for:
 * - User avatars
 * - Note images
 * - Note videos
 * - Note file attachments
 */
@Injectable()
export class StorageService {
  constructor(
    @Inject('STORAGE_STRATEGY') private readonly strategy: StorageStrategy,
  ) {}

  /**
   * Upload a file buffer to storage and return the file path.
   * 上传文件 buffer 到存储并返回文件路径。
   *
   * @param buffer File buffer / 文件 buffer
   * @param filename Original filename / 原始文件名
   * @param folder Folder path / 文件夹路径
   * @param contentType MIME type / MIME 类型
   * @returns File path / 文件路径
   */
  async uploadFile(
    buffer: Buffer,
    filename: string,
    folder: string,
    contentType: string,
  ): Promise<string> {
    return this.strategy.uploadFile(buffer, filename, folder, contentType);
  }

  /**
   * Upload a file from URL.
   * 从 URL 上传文件。
   */
  async uploadFromUrl(
    url: string,
    folder: string,
    filenamePrefix: string,
  ): Promise<string | null> {
    return this.strategy.uploadFromUrl(url, folder, filenamePrefix);
  }

  /**
   * Generate a signed URL for a file.
   * 为文件生成签名 URL。
   *
   * @param filename File path / 文件路径
   * @param expiresInMinutes URL expiration time in minutes (default 15) / URL 过期时间（分钟）（默认 15）
   * @returns Signed URL / 签名 URL
   */
  async getSignedUrl(
    filename: string,
    expiresInMinutes: number = 15,
  ): Promise<string | null> {
    return this.strategy.getSignedUrl(filename, expiresInMinutes);
  }

  /**
   * Delete a file.
   * 删除文件。
   */
  async deleteFile(filename: string): Promise<boolean> {
    return this.strategy.deleteFile(filename);
  }

  /**
   * Check if file exists.
   * 检查文件是否存在。
   */
  async fileExists(filename: string): Promise<boolean> {
    return this.strategy.fileExists(filename);
  }

  /**
   * Get file metadata.
   * 获取文件元数据。
   */
  async getFileMetadata(filename: string): Promise<any> {
    return this.strategy.getFileMetadata(filename);
  }
}
