class MicrosoftLoginDto {
  final String idToken;

  MicrosoftLoginDto({
    required this.idToken,
  });

  factory MicrosoftLoginDto.fromJson(Map<String, dynamic> json) {
    return MicrosoftLoginDto(
      idToken: json['idToken'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'idToken': this.idToken,
    };
  }
}