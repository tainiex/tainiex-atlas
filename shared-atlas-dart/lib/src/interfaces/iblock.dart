import 'package:shared_atlas_dart/shared_atlas_dart.dart';

class IBlock {
  final String id;
  final String noteId;
  final BlockType type;
  final String content;
  final dynamic metadata;
  final String? parentBlockId;
  final num position;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String createdBy;
  final String lastEditedBy;
  final List<IBlock>? children;
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