/**
 * StorageStrategy Interface
 * 存储策略接口
 *
 * Defines the contract for different storage implementations (GCS, AWS S3, Local, etc.).
 * 定义不同存储实现（GCS, AWS S3, 本地等）的契约。
 */
export interface StorageStrategy {
  /**
   * Upload a file buffer to the storage provider.
   * 上传文件 buffer 到存储提供商。
   *
   * @param buffer File buffer / 文件 buffer
   * @param filename Original filename / 原始文件名
   * @param folder Folder path / 文件夹路径
   * @param contentType MIME type / MIME 类型
   * @returns File path or identifier / 文件路径或标识符
   */
  uploadFile(
    buffer: Buffer,
    filename: string,
    folder: string,
    contentType: string,
  ): Promise<string>;

  /**
   * Upload a file from a URL.
   * 从 URL 上传文件。
   *
   * @param url Source URL / 源 URL
   * @param folder Target folder / 目标文件夹
   * @param filenamePrefix Prefix for the filename / 文件名前缀
   * @returns File path or null if failed / 文件路径，如果失败则返回 null
   */
  uploadFromUrl(
    url: string,
    folder: string,
    filenamePrefix: string,
  ): Promise<string | null>;

  /**
   * Generate a signed URL for a file.
   * 为文件生成签名 URL。
   *
   * @param filename File path / 文件路径
   * @param expiresInMinutes Expiration time in minutes /过期时间（分钟）
   * @returns Signed URL or null / 签名 URL，如果失败则返回 null
   */
  getSignedUrl(
    filename: string,
    expiresInMinutes?: number,
  ): Promise<string | null>;

  /**
   * Delete a file.
   * 删除文件。
   *
   * @param filename File path / 文件路径
   * @returns True if deleted successfully / 如果删除成功返回 true
   */
  deleteFile(filename: string): Promise<boolean>;

  /**
   * Check if a file exists.
   * 检查文件是否存在。
   *
   * @param filename File path / 文件路径
   * @returns True if exists / 如果存在返回 true
   */
  fileExists(filename: string): Promise<boolean>;

  /**
   * Get file metadata.
   * 获取文件元数据。
   *
   * @param filename File path / 文件路径
   * @returns Metadata object / 元数据对象
   */
  getFileMetadata(filename: string): Promise<any>;
}
