class INote {
  final String id;
  final String userId;
  final String title;
  final String? coverImage;
  final String? icon;
  final String? parentId;
  final bool? hasChildren;
  final String? template;
  final bool isPublic;
  final bool isDeleted;
  final dynamic createdAt;
  final dynamic updatedAt;
  final String lastEditedBy;

  INote({
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

  factory INote.fromJson(Map<String, dynamic> json) {
    return INote(
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