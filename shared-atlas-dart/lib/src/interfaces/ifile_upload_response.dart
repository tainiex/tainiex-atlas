class IFileUploadResponse {
  final bool success;
  final String url;
  final String path;
  final num? expiresAt;
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