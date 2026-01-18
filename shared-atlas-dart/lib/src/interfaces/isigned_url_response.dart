/// Signed URL Response
/// 签名 URL 响应
class ISignedUrlResponse {
  /// New signed URL
  /// 新签名 URL
  final String url;
  /// GCS path (for verification)
  /// GCS 路径（用于验证）
  final String path;
  /// URL expiration timestamp (Unix milliseconds)
  /// URL 过期时间戳（Unix 毫秒）
  final num expiresAt;
  /// Seconds until expiration
  /// 距离过期的秒数
  final num expiresIn;

  ISignedUrlResponse({
    required this.url,
    required this.path,
    required this.expiresAt,
    required this.expiresIn,
  });

  factory ISignedUrlResponse.fromJson(Map<String, dynamic> json) {
    return ISignedUrlResponse(
      url: json['url'] as String,
      path: json['path'] as String,
      expiresAt: json['expiresAt'] as num,
      expiresIn: json['expiresIn'] as num,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'url': this.url,
      'path': this.path,
      'expiresAt': this.expiresAt,
      'expiresIn': this.expiresIn,
    };
  }
}