/// Represents a chat session or conversation thread.
/// Only metadata is stored here; messages are retrieved separately.
/// 代表一个聊天会话或对话线程。此处仅存储元数据，消息内容需单独获取。
/// 
/// Related APIs / 相关接口:
/// - `GET /api/chat/sessions`: Returns a list of sessions (ChatSession[]).
/// - `GET /api/chat/sessions/:id`: Returns details of a specific session.
/// - `POST /api/chat/sessions`: Creates and returns a new session.
class IChatSession {
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

  IChatSession({
    required this.id,
    required this.userId,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
  });

  factory IChatSession.fromJson(Map<String, dynamic> json) {
    return IChatSession(
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