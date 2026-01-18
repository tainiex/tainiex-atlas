import 'package:shared_atlas_dart/shared_atlas_dart.dart';

class CreateBlockDto {
  final BlockType type;
  final String content;
  final dynamic metadata;
  final String? parentBlockId;
  final num? position;

  CreateBlockDto({
    required this.type,
    required this.content,
    this.metadata,
    this.parentBlockId,
    this.position,
  });

  factory CreateBlockDto.fromJson(Map<String, dynamic> json) {
    return CreateBlockDto(
      type: BlockType.fromJson(json['type']),
      content: json['content'] as String,
      metadata: json['metadata'] as dynamic,
      parentBlockId: json['parentBlockId'] as String?,
      position: json['position'] as num?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'type': this.type.toJson(),
      'content': this.content,
      'metadata': this.metadata,
      'parentBlockId': this.parentBlockId,
      'position': this.position,
    };
  }
}