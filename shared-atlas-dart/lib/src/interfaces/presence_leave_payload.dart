/// Event when a user leaves the collaboration session.
/// 用户离开协作会话时的事件。
/// 
/// Event: `server.emit('presence:leave', payload)`
class PresenceLeavePayload {
  /// User ID / 用户ID
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