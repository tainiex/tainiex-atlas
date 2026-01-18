import 'package:shared_atlas_dart/shared_atlas_dart.dart';

/// Represents a content block within a note.
/// 代表笔记中的一个内容块。
/// 
/// Related APIs / 相关接口:
/// - `GET /api/notes/:noteId/blocks`: Returns all blocks of a note.
/// - `POST /api/notes/:noteId/blocks`: Creates a new block.
/// - `PATCH /api/blocks/:id`: Updates a block.
class IBlock {
  /// Unique UUID of the block.
  /// 块的唯一 UUID。
  final String id;
  /// UUID of the note this block belongs to.
  /// 此块所属笔记的 UUID。
  final String noteId;
  /// Type of the block (text, heading, image, etc.).
  /// 块的类型（文本、标题、图片等）。
  final BlockType type;
  /// Plain text content or serialized content.
  /// For images/videos/files, this is the GCS URL.
  /// 纯文本内容或序列化内容。
  /// 对于图片/视频/文件，这是GCS URL。
  final String content;
  /// Type-specific metadata (JSON object).
  /// Examples: table structure, code language, file info.
  /// 块类型特定的元数据（JSON对象）。
  /// 示例：表格结构、代码语言、文件信息。
  final dynamic metadata;
  /// Optional parent block ID for nested structures.
  /// 可选的父块ID，用于嵌套结构。
  final String? parentBlockId;
  /// Position/order within parent (0-indexed).
  /// 在父级中的位置/顺序（从0开始）。
  final num position;
  /// Timestamp when the block was created.
  /// 块创建时间。
  final DateTime createdAt;
  /// Timestamp when the block was last updated.
  /// 块最后更新时间。
  final DateTime updatedAt;
  /// UUID of the user who created this block.
  /// 创建此块的用户UUID。
  final String createdBy;
  /// UUID of the user who last edited this block.
  /// 最后编辑此块的用户UUID。
  final String lastEditedBy;
  /// Optional nested children blocks (for tree structure rendering).
  /// 可选的嵌套子块（用于树状结构渲染）。
  final List<IBlock>? children;
  /// Optional soft delete flag.
  /// 可选的软删除标记。
  final bool? isDeleted;

  IBlock({
    required this.id,
    required this.noteId,
    required this.type,
    required this.content,
    required this.metadata,
    this.parentBlockId,
    required this.position,
    required this.createdAt,
    required this.updatedAt,
    required this.createdBy,
    required this.lastEditedBy,
    this.children,
    this.isDeleted,
  });

  factory IBlock.fromJson(Map<String, dynamic> json) {
    return IBlock(
      id: json['id'] as String,
      noteId: json['noteId'] as String,
      type: BlockType.fromJson(json['type']),
      content: json['content'] as String,
      metadata: json['metadata'] as dynamic,
      parentBlockId: json['parentBlockId'] as String?,
      position: json['position'] as num,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      createdBy: json['createdBy'] as String,
      lastEditedBy: json['lastEditedBy'] as String,
      children: (json['children'] as List<dynamic>?)?.map((e) => IBlock.fromJson(e as Map<String, dynamic>)).toList(),
      isDeleted: json['isDeleted'] as bool?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'id': this.id,
      'noteId': this.noteId,
      'type': this.type.toJson(),
      'content': this.content,
      'metadata': this.metadata,
      'parentBlockId': this.parentBlockId,
      'position': this.position,
      'createdAt': this.createdAt.toIso8601String(),
      'updatedAt': this.updatedAt.toIso8601String(),
      'createdBy': this.createdBy,
      'lastEditedBy': this.lastEditedBy,
      'children': this.children?.map((e) => e.toJson()).toList(),
      'isDeleted': this.isDeleted,
    };
  }
}