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
