/// Payload for updating note metadata.
/// 更新笔记元数据的请求体。
/// 
/// API: `PATCH /api/notes/:id`
class UpdateNoteDto {
  /// Optional new title.
  /// 可选的新标题。
  final String? title;
  /// Optional new cover image URL.
  /// 可选的新封面图片URL。
  final String? coverImage;
  /// Optional new icon.
  /// 可选的新图标。
  final String? icon;

  UpdateNoteDto({
    this.title,
    this.coverImage,
    this.icon,
  });

  factory UpdateNoteDto.fromJson(Map<String, dynamic> json) {
    return UpdateNoteDto(
      title: json['title'] as String?,
      coverImage: json['coverImage'] as String?,
      icon: json['icon'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'title': this.title,
      'coverImage': this.coverImage,
      'icon': this.icon,
    };
  }
}