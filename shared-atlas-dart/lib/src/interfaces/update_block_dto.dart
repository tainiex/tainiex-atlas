class UpdateBlockDto {
  final String? content;
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