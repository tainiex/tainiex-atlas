class GetSignedUrlQueryDto {
  final String path;
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