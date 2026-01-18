import 'package:shared_atlas_dart/shared_atlas_dart.dart';

class AddMessageDto {
  final String content;
  final ChatRole? role;
  final String? model;
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