/// Get Signed URL Query DTO
/// 获取签名 URL 查询 DTO
/// 
/// Request a fresh signed URL for an existing GCS path.
/// 为现有 GCS 路径请求新的签名 URL。
class GetSignedUrlQueryDto {
  /// Internal GCS path
  /// 内部 GCS 路径
  final String path;
  /// Optional expiration time in seconds
  /// 可选的过期时间（秒）
  final int? expirationSeconds;

  GetSignedUrlQueryDto({
    required this.path,
    this.expirationSeconds,
  });

  factory GetSignedUrlQueryDto.fromJson(Map<String, dynamic> json) {
    return GetSignedUrlQueryDto(
      path: json['path'] as String,
      expirationSeconds: json['expirationSeconds'] as int?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'path': this.path,
      'expirationSeconds': this.expirationSeconds,
    };
  }
}