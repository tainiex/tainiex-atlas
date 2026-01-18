class INoteTemplate {
  final String id;
  final String name;
  final String? description;
  final String? thumbnail;
  final String category;
  final bool isPublic;
  final String? createdBy;
  final dynamic templateData;
  final num usageCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  INoteTemplate({
    required this.id,
    required this.name,
    this.description,
    this.thumbnail,
    required this.category,
    required this.isPublic,
    this.createdBy,
    required this.templateData,
    required this.usageCount,
    required this.createdAt,
    required this.updatedAt,
  });

  factory INoteTemplate.fromJson(Map<String, dynamic> json) {
    return INoteTemplate(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      thumbnail: json['thumbnail'] as String?,
      category: json['category'] as String,
      isPublic: json['isPublic'] as bool,
      createdBy: json['createdBy'] as String?,
      templateData: json['templateData'] as dynamic,
      usageCount: json['usageCount'] as num,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'id': this.id,
      'name': this.name,
      'description': this.description,
      'thumbnail': this.thumbnail,
      'category': this.category,
      'isPublic': this.isPublic,
      'createdBy': this.createdBy,
      'templateData': this.templateData,
      'usageCount': this.usageCount,
      'createdAt': this.createdAt.toIso8601String(),
      'updatedAt': this.updatedAt.toIso8601String(),
    };
  }
}