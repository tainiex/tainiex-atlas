import 'package:shared_atlas_dart/shared_atlas_dart.dart';

/// API response structure for a note with blocks.
/// 包含块的笔记的 API 响应结构。
class NoteWithBlocksResponse {
  /// All blocks in this note (tree structure).
  /// 此笔记中的所有块（树状结构）。
  final List<IBlock> blocks;
  /// Unique UUID of the note.
  /// 笔记的唯一 UUID。
  final String id;
  /// UUID of the user who owns this note.
  /// 拥有此笔记的用户的 UUID。
  final String userId;
  /// Title of the note (max 200 characters).
  /// 笔记标题（最多200字符）。
  final String title;
  /// Optional cover image URL (GCS signed URL).
  /// 可选的封面图片URL（GCS签名URL）。
  final String? coverImage;
  /// Optional icon emoji or URL.
  /// 可选的图标emoji或URL。
  final String? icon;
  /// Optional parent note ID for hierarchical structure.
  /// 可选的父笔记ID，用于构建层级结构。
  final String? parentId;
  /// Whether the note has children (computed property).
  /// 笔记是否有子节点（计算属性）。
  final bool? hasChildren;
  /// Optional template type used to create this note.
  /// 可选的模板类型，用于创建此笔记。
  final String? template;
  /// Whether the note is publicly accessible.
  /// 笔记是否公开可访问。
  final bool isPublic;
  /// Soft delete flag.
  /// 软删除标记。
  final bool isDeleted;
  /// Timestamp when the note was created.
  /// 笔记创建时间。
  final dynamic createdAt;
  /// Timestamp when the note was last updated.
  /// 笔记最后更新时间。
  final dynamic updatedAt;
  /// UUID of the user who last edited this note.
  /// 最后编辑此笔记的用户UUID。
  final String lastEditedBy;

  NoteWithBlocksResponse({
    required this.blocks,
    required this.id,
    required this.userId,
    required this.title,
    this.coverImage,
    this.icon,
    this.parentId,
    this.hasChildren,
    this.template,
    required this.isPublic,
    required this.isDeleted,
    required this.createdAt,
    required this.updatedAt,
    required this.lastEditedBy,
  });

  factory NoteWithBlocksResponse.fromJson(Map<String, dynamic> json) {
    return NoteWithBlocksResponse(
      blocks: (json['blocks'] as List<dynamic>).map((e) => IBlock.fromJson(e as Map<String, dynamic>)).toList(),
      id: json['id'] as String,
      userId: json['userId'] as String,
      title: json['title'] as String,
      coverImage: json['coverImage'] as String?,
      icon: json['icon'] as String?,
      parentId: json['parentId'] as String?,
      hasChildren: json['hasChildren'] as bool?,
      template: json['template'] as String?,
      isPublic: json['isPublic'] as bool,
      isDeleted: json['isDeleted'] as bool,
      createdAt: json['createdAt'] as dynamic,
      updatedAt: json['updatedAt'] as dynamic,
      lastEditedBy: json['lastEditedBy'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'blocks': this.blocks.map((e) => e.toJson()).toList(),
      'id': this.id,
      'userId': this.userId,
      'title': this.title,
      'coverImage': this.coverImage,
      'icon': this.icon,
      'parentId': this.parentId,
      'hasChildren': this.hasChildren,
      'template': this.template,
      'isPublic': this.isPublic,
      'isDeleted': this.isDeleted,
      'createdAt': this.createdAt,
      'updatedAt': this.updatedAt,
      'lastEditedBy': this.lastEditedBy,
    };
  }
}