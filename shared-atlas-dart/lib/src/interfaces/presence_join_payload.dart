/// Event when a user joins the collaboration session.
/// 用户加入协作会话时的事件。
/// 
/// Event: `server.emit('presence:join', payload)`
class PresenceJoinPayload {
  /// User ID / 用户ID
  final String userId;
  /// Username / 用户名
  final String username;
  /// User avatar URL / 用户头像URL
  final String? avatar;
  /// Assigned color / 分配的颜色
  final String color;

  PresenceJoinPayload({
    required this.userId,
    required this.username,
    this.avatar,
    required this.color,
  });

  factory PresenceJoinPayload.fromJson(Map<String, dynamic> json) {
    return PresenceJoinPayload(
      userId: json['userId'] as String,
      username: json['username'] as String,
      avatar: json['avatar'] as String?,
      color: json['color'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'userId': this.userId,
      'username': this.username,
      'avatar': this.avatar,
      'color': this.color,
    };
  }
}