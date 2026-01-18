import 'package:shared_atlas_dart/shared_atlas_dart.dart';

/// Payload for sending a message via WebSocket.
/// 通过 WebSocket 发送消息的 Payload。
/// 
/// Event: `client.emit('chat:send', payload)`
class ChatSendPayload {
  /// Session ID to send the message to.
  /// 目标会话 ID。
  final String sessionId;
  /// Message content.
  /// 消息内容。
  final String content;
  /// Optional role (defaults to USER).
  /// 角色（可选，默认 USER）。
  final ChatRole? role;
  /// Optional model to use for response generation.
  /// 指定模型（可选）。
  final String? model;
  /// Optional parent ID.
  /// 父消息 ID (可选).
  final String? parentId;

  ChatSendPayload({
    required this.sessionId,
    required this.content,
    this.role,
    this.model,
    this.parentId,
  });

  factory ChatSendPayload.fromJson(Map<String, dynamic> json) {
    return ChatSendPayload(
      sessionId: json['sessionId'] as String,
      content: json['content'] as String,
      role: json['role'] == null ? null : ChatRole.fromJson(json['role']),
      model: json['model'] as String?,
      parentId: json['parentId'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'sessionId': this.sessionId,
      'content': this.content,
      'role': this.role?.toJson(),
      'model': this.model,
      'parentId': this.parentId,
    };
  }
}