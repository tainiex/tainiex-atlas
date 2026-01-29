import { ConfigService } from '@nestjs/config';
import { Storage, StorageOptions } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { StorageStrategy } from './storage.strategy.interface';
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';

/**
 * GcsStorageStrategy
 * GCS 存储策略实现
 *
 * Implements StorageStrategy for Google Cloud Storage.
 * 为 Google Cloud Storage 实现 StorageStrategy。
 */
@Injectable()
export class GcsStorageStrategy implements StorageStrategy {
    private storage: Storage;
    private bucketName: string;
    private serviceAccountEmail: string | undefined;

    constructor(
        private configService: ConfigService,
        private logger: LoggerService
    ) {
        this.logger.setContext(GcsStorageStrategy.name);
        const gsaKeyFile = this.configService.get<string>('GSA_KEY_FILE');
        const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
        this.serviceAccountEmail = this.configService.get<string>('GCS_SERVICE_ACCOUNT');
        this.bucketName = this.configService.get<string>('GCS_BUCKET_NAME') || '';

        if (!this.bucketName) {
            this.logger.warn('GCS_BUCKET_NAME not configured');
        }

        const storageOptions: StorageOptions = {
            projectId: projectId,
        };

        if (gsaKeyFile) {
            storageOptions.keyFilename = gsaKeyFile;
        }

        this.storage = new Storage(storageOptions);
        this.logger.log(`Initialized for project: ${projectId}, bucket: ${this.bucketName}`);
    }

    async uploadFile(
        buffer: Buffer,
        filename: string,
        folder: string,
        contentType: string
    ): Promise<string> {
        if (!this.bucketName) {
            throw new Error('GCS bucket name not configured');
        }

        // Generate unique filename with date structure (YYYY/MM)
        // 生成具有日期结构 (YYYY/MM) 的唯一文件名
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const ext = filename.split('.').pop();
        const uniqueFilename = `${folder}/${year}/${month}/${uuidv4()}.${ext}`;

        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(uniqueFilename);

        await file.save(buffer, {
            metadata: {
                contentType,
            },
        });

        this.logger.log(`Uploaded file: ${uniqueFilename}`);
        return uniqueFilename;
    }

    async uploadFromUrl(
        url: string,
        folder: string,
        filenamePrefix: string
    ): Promise<string | null> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.statusText}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const ext = contentType.split('/')[1] || 'jpg';
            const filename = `${filenamePrefix}.${ext}`;

            return await this.uploadFile(buffer, filename, folder, contentType);
        } catch (error: unknown) {
            this.logger.error(
                `Upload from URL failed: ${error instanceof Error ? error.message : String(error)}`
            );
            return null;
        }
    }

    async getSignedUrl(filename: string, expiresInMinutes: number = 15): Promise<string | null> {
        try {
            if (!this.bucketName || !filename) {
                return filename || null;
            }

            // Already a URL / 已经是 URL
            if (filename.startsWith('http')) {
                return filename;
            }

            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(filename);

            const [url] = await file.getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + expiresInMinutes * 60 * 1000,
                ...(this.serviceAccountEmail ? { clientEmail: this.serviceAccountEmail } : {}),
            });

            return url;
        } catch (error: unknown) {
            this.logger.error(
                `SignedURL Error for ${filename}: ${error instanceof Error ? error.message : String(error)}`
            );
            return null;
        }
    }

    async deleteFile(filename: string): Promise<boolean> {
        try {
            if (!this.bucketName || !filename) {
                return false;
            }

            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(filename);

            await file.delete();
            this.logger.log(`Deleted file: ${filename}`);
            return true;
        } catch (error: unknown) {
            this.logger.error(
                `Delete Error for ${filename}: ${error instanceof Error ? error.message : String(error)}`
            );
            return false;
        }
    }

    async fileExists(filename: string): Promise<boolean> {
        try {
            if (!this.bucketName || !filename) {
                return false;
            }

            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(filename);

            const [exists] = await file.exists();
            return exists;
        } catch (error: unknown) {
            this.logger.error(
                `Exists check failed for ${filename}: ${error instanceof Error ? error.message : String(error)}`
            );
            return false;
        }
    }

    async getFileMetadata(filename: string): Promise<any> {
        try {
            if (!this.bucketName || !filename) {
                return null;
            }

            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(filename);

            const [metadata] = await file.getMetadata();
            return {
                size: metadata.size,
                contentType: metadata.contentType,
                created: metadata.timeCreated,
                updated: metadata.updated,
            };
        } catch (error: unknown) {
            this.logger.error(
                `Metadata fetch failed for ${filename}: ${error instanceof Error ? error.message : String(error)}`
            );
            return null;
        }
    }
}
