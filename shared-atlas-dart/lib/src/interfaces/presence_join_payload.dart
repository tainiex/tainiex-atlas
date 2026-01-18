class PresenceJoinPayload {
  final String userId;
  final String username;
  final String? avatar;
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