class CreateNoteDto {
  final String title;
  final String? templateId;
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