class GoogleLoginDto {
  final String? code;
  final String? idToken;

  GoogleLoginDto({
    this.code,
    this.idToken,
  });

  factory GoogleLoginDto.fromJson(Map<String, dynamic> json) {
    return GoogleLoginDto(
      code: json['code'] as String?,
      idToken: json['idToken'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'code': this.code,
      'idToken': this.idToken,
    };
  }
}