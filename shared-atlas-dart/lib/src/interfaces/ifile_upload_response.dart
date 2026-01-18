/// Storage Interfaces
/// 存储接口
class IFileUploadResponse {
  /// Success status
  /// 成功状态
  final bool success;
  /// Signed URL for immediate access (valid for limited time)
  /// 用于立即访问的签名 URL（有时限）
  final String url;
  /// Internal GCS path (store this in DB)
  /// 内部 GCS 路径（存储在数据库中）
  final String path;
  /// URL expiration timestamp (Unix milliseconds)
  /// URL 过期时间戳（Unix 毫秒）
  final num? expiresAt;
  /// File metadata
  /// 文件元数据
  final dynamic metadata;

  IFileUploadResponse({
    required this.success,
    required this.url,
    required this.path,
    this.expiresAt,
    required this.metadata,
  });

  factory IFileUploadResponse.fromJson(Map<String, dynamic> json) {
    return IFileUploadResponse(
      success: json['success'] as bool,
      url: json['url'] as String,
      path: json['path'] as String,
      expiresAt: json['expiresAt'] as num?,
      metadata: json['metadata'] as dynamic,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'success': this.success,
      'url': this.url,
      'path': this.path,
      'expiresAt': this.expiresAt,
      'metadata': this.metadata,
    };
  }
}