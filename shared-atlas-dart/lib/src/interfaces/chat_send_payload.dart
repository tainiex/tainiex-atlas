import 'package:shared_atlas_dart/shared_atlas_dart.dart';

class ChatSendPayload {
  final String sessionId;
  final String content;
  final ChatRole? role;
  final String? model;
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