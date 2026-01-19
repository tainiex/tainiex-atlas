class WsTokenExpiringPayload {
  final num expiresIn;

  WsTokenExpiringPayload({
    required this.expiresIn,
  });

  factory WsTokenExpiringPayload.fromJson(Map<String, dynamic> json) {
    return WsTokenExpiringPayload(
      expiresIn: json['expiresIn'] as num,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'expiresIn': this.expiresIn,
    };
  }
}