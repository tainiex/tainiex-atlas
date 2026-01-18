class SocialSignupDto {
  final String invitationCode;
  final String signupToken;

  SocialSignupDto({
    required this.invitationCode,
    required this.signupToken,
  });

  factory SocialSignupDto.fromJson(Map<String, dynamic> json) {
    return SocialSignupDto(
      invitationCode: json['invitationCode'] as String,
      signupToken: json['signupToken'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'invitationCode': this.invitationCode,
      'signupToken': this.signupToken,
    };
  }
}