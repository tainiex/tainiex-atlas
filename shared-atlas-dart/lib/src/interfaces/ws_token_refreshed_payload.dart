class WsTokenRefreshedPayload {
  final String newToken;

  WsTokenRefreshedPayload({
    required this.newToken,
  });

  factory WsTokenRefreshedPayload.fromJson(Map<String, dynamic> json) {
    return WsTokenRefreshedPayload(
      newToken: json['newToken'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'newToken': this.newToken,
    };
  }
}