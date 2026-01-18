import 'package:shared_atlas_dart/shared_atlas_dart.dart';

class IChatMessage {
  final String id;
  final String sessionId;
  final ChatRole role;
  final String content;
  final DateTime createdAt;
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