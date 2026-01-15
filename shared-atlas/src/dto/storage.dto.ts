import { IsEnum, IsOptional, IsString } from 'class-validator';

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
