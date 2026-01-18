/// Token Response - Used for refresh token endpoint
/// Contains access and refresh tokens
class TokenResponse {
  final String access_token;
  final String refresh_token;

  TokenResponse({
    required this.access_token,
    required this.refresh_token,
  });

  factory TokenResponse.fromJson(Map<String, dynamic> json) {
    return TokenResponse(
      access_token: json['access_token'] as String,
      refresh_token: json['refresh_token'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'access_token': this.access_token,
      'refresh_token': this.refresh_token,
    };
  }
}