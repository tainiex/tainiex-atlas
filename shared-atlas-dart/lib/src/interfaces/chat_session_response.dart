/// API response structure for a chat session.
/// Match of IChatSession for now.
/// 聊天会话的 API 响应结构，目前与 IChatSession 一致。
class ChatSessionResponse {
  /// Unique UUID of the session.
  /// 会话的唯一 UUID。
  final String id;
  /// UUID of the user who owns this session.
  /// 拥有此会话的用户的 UUID。
  final String userId;
  /// Auto-generated title of the conversation.
  /// Usually summarized from the first message.
  /// 会话标题，通常由第一条消息自动总结生成。
  final String title;
  /// Timestamp when the session was created.
  /// 会话创建时间。
  final DateTime createdAt;
  /// Timestamp when the last message was added or session updated.
  /// 会话最后更新时间（如有新消息）。
  final DateTime updatedAt;

  ChatSessionResponse({
    required this.id,
    required this.userId,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ChatSessionResponse.fromJson(Map<String, dynamic> json) {
    return ChatSessionResponse(
      id: json['id'] as String,
      userId: json['userId'] as String,
      title: json['title'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'id': this.id,
      'userId': this.userId,
      'title': this.title,
      'createdAt': this.createdAt.toIso8601String(),
      'updatedAt': this.updatedAt.toIso8601String(),
    };
  }
}