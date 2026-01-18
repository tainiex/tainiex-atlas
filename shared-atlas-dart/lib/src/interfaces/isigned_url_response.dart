class ISignedUrlResponse {
  final String url;
  final String path;
  final num expiresAt;
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