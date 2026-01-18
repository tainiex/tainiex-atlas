class SignupDto {
  final String username;
  final String password;
  final String invitationCode;
  final String? email;

  SignupDto({
    required this.username,
    required this.password,
    required this.invitationCode,
    this.email,
  });

  factory SignupDto.fromJson(Map<String, dynamic> json) {
    return SignupDto(
      username: json['username'] as String,
      password: json['password'] as String,
      invitationCode: json['invitationCode'] as String,
      email: json['email'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'username': this.username,
      'password': this.password,
      'invitationCode': this.invitationCode,
      'email': this.email,
    };
  }
}