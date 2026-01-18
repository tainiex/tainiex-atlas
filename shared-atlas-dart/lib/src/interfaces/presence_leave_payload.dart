class PresenceLeavePayload {
  final String userId;

  PresenceLeavePayload({
    required this.userId,
  });

  factory PresenceLeavePayload.fromJson(Map<String, dynamic> json) {
    return PresenceLeavePayload(
      userId: json['userId'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'userId': this.userId,
    };
  }
}