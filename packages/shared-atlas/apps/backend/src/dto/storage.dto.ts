import { IsEnum, IsOptional, IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

/**
 * Storage Module Enum
 * 存储模块枚举
 * 
 * Defines valid module prefixes for file organization.
 * 定义文件组织的有效模块前缀。
 */
export enum StorageModule {
    NOTES = 'notes',
    CHAT = 'chats',
}

/**
 * Upload File Query DTO
 * 上传文件查询 DTO
 * 
 * Validates query parameters for file upload endpoint.
 * 验证文件上传端点的查询参数。
 */
export class UploadFileQueryDto {
    /**
     * Module prefix for directory separation
     * 目录分离的模块前缀
     * 
     * @example 'notes'
     * @example 'chats'
     */
    @IsOptional()
    @IsEnum(StorageModule, {
        message: 'module must be either "notes" or "chats"',
    })
    module?: StorageModule;

    /**
     * Target folder within the module
     * 模块内的目标文件夹
     * 
     * @example 'images'
     * @example 'attachments'
     * @default 'uploads'
     */
    @IsOptional()
    @IsString()
    folder?: string;
}

/**
 * Get Signed URL Query DTO
 * 获取签名 URL 查询 DTO
 *
 * Request a fresh signed URL for an existing GCS path.
 * 为现有 GCS 路径请求新的签名 URL。
 */
export class GetSignedUrlQueryDto {
    /**
     * Internal GCS path
     * 内部 GCS 路径
     *
     * @example 'notes/user-123/images/abc.jpg'
     */
    @IsString()
    @IsNotEmpty({
        message: 'path is required',
    })
    path: string;

    /**
     * Optional expiration time in seconds
     * 可选的过期时间（秒）
     *
     * @default 3600 (1 hour)
     */
    @IsOptional()
    @IsInt()
    @Min(60)
    @Max(86400) // Max 24 hours
    expirationSeconds?: number;
}
