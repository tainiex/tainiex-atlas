class RefreshTokenDto {
  final String? refreshToken;

  RefreshTokenDto({
    this.refreshToken,
  });

  factory RefreshTokenDto.fromJson(Map<String, dynamic> json) {
    return RefreshTokenDto(
      refreshToken: json['refreshToken'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'refreshToken': this.refreshToken,
    };
  }
}