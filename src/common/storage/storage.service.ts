import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

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
    private storage: Storage;
    private bucketName: string;
    private serviceAccountEmail: string | undefined;

    constructor(private configService: ConfigService) {
        const gsaKeyFile = this.configService.get<string>('GSA_KEY_FILE');
        const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
        this.serviceAccountEmail = this.configService.get<string>('GCS_SERVICE_ACCOUNT');
        this.bucketName = this.configService.get<string>('GCS_BUCKET_NAME') || '';

        if (!this.bucketName) {
            console.warn('[StorageService] GCS_BUCKET_NAME not configured');
        }

        const storageOptions: any = {
            projectId: projectId,
        };

        if (gsaKeyFile) {
            storageOptions.keyFilename = gsaKeyFile;
        }

        this.storage = new Storage(storageOptions);
        console.log(`[StorageService] Initialized for project: ${projectId}, bucket: ${this.bucketName}`);
    }

    /**
     * Upload a file buffer to GCS and return the file path.
     * 上传文件buffer到GCS并返回文件路径。
     * 
     * @param buffer File buffer
     * @param filename Original filename
     * @param folder Folder path in bucket (e.g., 'avatars', 'notes/images')
     * @param contentType MIME type
     * @returns GCS file path
     */
    async uploadFile(
        buffer: Buffer,
        filename: string,
        folder: string,
        contentType: string
    ): Promise<string> {
        if (!this.bucketName) {
            throw new Error('GCS bucket name not configured');
        }

        // Generate unique filename
        const ext = filename.split('.').pop();
        const uniqueFilename = `${folder}/${uuidv4()}.${ext}`;

        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(uniqueFilename);

        await file.save(buffer, {
            metadata: {
                contentType,
            },
        });

        console.log(`[StorageService] Uploaded file: ${uniqueFilename}`);
        return uniqueFilename;
    }

    /**
     * Upload a file from URL (for external images like avatars).
     * 从URL上传文件（如头像等外部图片）。
     */
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
        } catch (error) {
            console.error('[StorageService] Upload from URL failed:', error);
            return null;
        }
    }

    /**
     * Generate a signed URL for a file.
     * 为文件生成签名URL。
     * 
     * @param filename GCS file path
     * @param expiresInMinutes URL expiration time in minutes (default 15)
     * @returns Signed URL
     */
    async getSignedUrl(filename: string, expiresInMinutes: number = 15): Promise<string | null> {
        try {
            if (!this.bucketName || !filename) {
                return filename || null;
            }

            // Already a URL
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
        } catch (error) {
            console.error(`[StorageService] SignedURL Error for ${filename}:`, error.message);
            return null;
        }
    }

    /**
     * Delete a file from GCS.
     * 从GCS删除文件。
     */
    async deleteFile(filename: string): Promise<boolean> {
        try {
            if (!this.bucketName || !filename) {
                return false;
            }

            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(filename);

            await file.delete();
            console.log(`[StorageService] Deleted file: ${filename}`);
            return true;
        } catch (error) {
            console.error(`[StorageService] Delete Error for ${filename}:`, error.message);
            return false;
        }
    }

    /**
     * Check if file exists in GCS.
     * 检查文件是否存在于GCS。
     */
    async fileExists(filename: string): Promise<boolean> {
        try {
            if (!this.bucketName || !filename) {
                return false;
            }

            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(filename);

            const [exists] = await file.exists();
            return exists;
        } catch (error) {
            console.error(`[StorageService] Exists check failed for ${filename}:`, error.message);
            return false;
        }
    }

    /**
     * Get file metadata.
     * 获取文件元数据。
     */
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
        } catch (error) {
            console.error(`[StorageService] Metadata fetch failed for ${filename}:`, error.message);
            return null;
        }
    }
}
