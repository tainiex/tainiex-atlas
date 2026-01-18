/// Payload for updating a block.
/// 更新块的请求体。
/// 
/// API: `PATCH /api/blocks/:id`
class UpdateBlockDto {
  /// Optional new content.
  /// 可选的新内容。
  final String? content;
  /// Optional new metadata.
  /// 可选的新元数据。
  final dynamic metadata;

  UpdateBlockDto({
    this.content,
    this.metadata,
  });

  factory UpdateBlockDto.fromJson(Map<String, dynamic> json) {
    return UpdateBlockDto(
      content: json['content'] as String?,
      metadata: json['metadata'] as dynamic,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'content': this.content,
      'metadata': this.metadata,
    };
  }
}