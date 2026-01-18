import 'package:shared_atlas_dart/shared_atlas_dart.dart';

/// Payload for adding a new message to a session via REST API.
/// 通过 REST API 向会话添加新消息的请求体。
/// 
/// API: `POST /api/chat/sessions/:id/messages`
/// Note: This endpoint now supports Streaming responses (Server-Sent Events / Chunked Transfer).
/// 注意：此接口现在支持流式响应。
class AddMessageDto {
  /// The text content of the message to send.
  /// 发送的消息内容。
  final String content;
  /// Optional role of the sender.
  /// Defaults to 'user' if not specified.
  /// 发送者角色，默认为 'user'。
  final ChatRole? role;
  /// Optional model to use for generating response.
  /// If not provided, defaults to the system default model.
  /// 指定用于生成的模型 ID。如不填则使用系统默认模型。
  final String? model;
  /// Optional parent ID.
  /// 可选的父消息 ID。
  final String? parentId;

  AddMessageDto({
    required this.content,
    this.role,
    this.model,
    this.parentId,
  });

  factory AddMessageDto.fromJson(Map<String, dynamic> json) {
    return AddMessageDto(
      content: json['content'] as String,
      role: json['role'] == null ? null : ChatRole.fromJson(json['role']),
      model: json['model'] as String?,
      parentId: json['parentId'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'content': this.content,
      'role': this.role?.toJson(),
      'model': this.model,
      'parentId': this.parentId,
    };
  }
}