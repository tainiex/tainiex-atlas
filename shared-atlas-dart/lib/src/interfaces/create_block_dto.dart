import 'package:shared_atlas_dart/shared_atlas_dart.dart';

/// Payload for creating a new block.
/// 创建新块的请求体。
/// 
/// API: `POST /api/notes/:noteId/blocks`
class CreateBlockDto {
  /// Type of the block.
  /// 块的类型。
  final BlockType type;
  /// Content of the block.
  /// 块的内容。
  final String content;
  /// Optional metadata.
  /// 可选的元数据。
  final dynamic metadata;
  /// Optional parent block ID.
  /// 可选的父块ID。
  final String? parentBlockId;
  /// Optional position (defaults to end).
  /// 可选的位置（默认为末尾）。
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