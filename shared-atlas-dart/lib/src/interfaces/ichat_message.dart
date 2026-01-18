import 'package:shared_atlas_dart/shared_atlas_dart.dart';

/// Represents a single message within a chat session.
/// 代表聊天会话中的单条消息。
/// 
/// Related APIs / 相关接口:
/// - `GET /api/chat/sessions/:id/messages`: Returns a list of messages (ChatMessage[]).
class IChatMessage {
  /// Unique UUID of the message.
  /// 消息的唯一 UUID。
  final String id;
  /// UUID of the session this message belongs to.
  /// 此消息所属会话的 UUID。
  final String sessionId;
  /// The role of the sender (User or Assistant).
  /// 发送者角色（用户或 AI）。
  final ChatRole role;
  /// The actual text content of the message.
  /// 消息的文本内容。
  final String content;
  /// Timestamp when the message was created.
  /// 消息创建时间。
  final DateTime createdAt;
  /// ID of the parent message.
  /// 父消息 ID。
  final String parentId;

  IChatMessage({
    required this.id,
    required this.sessionId,
    required this.role,
    required this.content,
    required this.createdAt,
    required this.parentId,
  });

  factory IChatMessage.fromJson(Map<String, dynamic> json) {
    return IChatMessage(
      id: json['id'] as String,
      sessionId: json['sessionId'] as String,
      role: ChatRole.fromJson(json['role']),
      content: json['content'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      parentId: json['parentId'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'id': this.id,
      'sessionId': this.sessionId,
      'role': this.role.toJson(),
      'content': this.content,
      'createdAt': this.createdAt.toIso8601String(),
      'parentId': this.parentId,
    };
  }
}