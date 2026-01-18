/// Payload for creating a new note.
/// 创建新笔记的请求体。
/// 
/// API: `POST /api/notes`
class CreateNoteDto {
  /// Title of the note.
  /// 笔记标题。
  final String title;
  /// Optional template ID to create from.
  /// 可选的模板ID。
  final String? templateId;
  /// Optional parent note ID.
  /// 可选的父笔记ID。
  final String? parentId;

  CreateNoteDto({
    required this.title,
    this.templateId,
    this.parentId,
  });

  factory CreateNoteDto.fromJson(Map<String, dynamic> json) {
    return CreateNoteDto(
      title: json['title'] as String,
      templateId: json['templateId'] as String?,
      parentId: json['parentId'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'title': this.title,
      'templateId': this.templateId,
      'parentId': this.parentId,
    };
  }
}