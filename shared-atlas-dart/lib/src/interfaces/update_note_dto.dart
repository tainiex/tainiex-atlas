class UpdateNoteDto {
  final String? title;
  final String? coverImage;
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