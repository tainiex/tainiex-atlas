/**
 * Storage Interfaces
 * 存储接口
 */

/**
 * File Upload Response
 * 文件上传响应
 */
export interface IFileUploadResponse {
    /**
     * Success status
     * 成功状态
     */
    success: boolean;

    /**
     * Signed URL for immediate access (valid for limited time)
     * 用于立即访问的签名 URL（有时限）
     */
    url: string | null;

    /**
     * Internal GCS path (store this in DB)
     * 内部 GCS 路径（存储在数据库中）
     */
    path: string;

    /**
     * URL expiration timestamp (Unix milliseconds)
     * URL 过期时间戳（Unix 毫秒）
     * 
     * @new Added for URL refresh tracking
     */
    expiresAt?: number;

    /**
     * File metadata
     * 文件元数据
     */
    metadata: {
        /**
         * Original filename
         * 原始文件名
         */
        filename: string;

        /**
         * File size in bytes
         * 文件大小（字节）
         */
        size: number;

        /**
         * MIME type
         * MIME 类型
         */
        contentType: string;

        /**
         * Creation time
         * 创建时间
         */
        created?: string;

        /**
         * Update time
         * 更新时间
         */
        updated?: string;
    };
}

/**
 * Signed URL Response
 * 签名 URL 响应
 * 
 * @new Response format for URL refresh endpoint
 */
export interface ISignedUrlResponse {
    /**
     * New signed URL
     * 新签名 URL
     */
    url: string;

    /**
     * GCS path (for verification)
     * GCS 路径（用于验证）
     */
    path: string;

    /**
     * URL expiration timestamp (Unix milliseconds)
     * URL 过期时间戳（Unix 毫秒）
     */
    expiresAt: number;

    /**
     * Seconds until expiration
     * 距离过期的秒数
     */
    expiresIn: number;
}
