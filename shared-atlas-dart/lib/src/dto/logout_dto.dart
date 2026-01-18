class LogoutDto {
  final String? userId;

  LogoutDto({
    this.userId,
  });

  factory LogoutDto.fromJson(Map<String, dynamic> json) {
    return LogoutDto(
      userId: json['userId'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'userId': this.userId,
    };
  }
}