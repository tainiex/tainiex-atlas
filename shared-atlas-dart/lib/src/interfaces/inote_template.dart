/// Represents a note template.
/// 代表笔记模板。
/// 
/// Related APIs / 相关接口:
/// - `GET /api/templates`: Returns available templates.
/// - `POST /api/notes/from-template/:templateId`: Creates note from template.
class INoteTemplate {
  /// Unique UUID of the template.
  /// 模板的唯一 UUID。
  final String id;
  /// Template name.
  /// 模板名称。
  final String name;
  /// Optional description.
  /// 可选的描述。
  final String? description;
  /// Optional thumbnail URL.
  /// 可选的缩略图URL。
  final String? thumbnail;
  /// Category (e.g., 'meeting', 'project', 'doc').
  /// 分类（如：'meeting'、'project'、'doc'）。
  final String category;
  /// Whether this is a public/system template.
  /// 是否为公共/系统模板。
  final bool isPublic;
  /// Optional creator user ID (null for system templates).
  /// 可选的创建者用户ID（系统模板为null）。
  final String? createdBy;
  /// Template structure (array of block definitions).
  /// 模板结构（块定义数组）。
  final dynamic templateData;
  /// Number of times this template has been used.
  /// 此模板被使用的次数。
  final num usageCount;
  /// Timestamp when the template was created.
  /// 模板创建时间。
  final DateTime createdAt;
  /// Timestamp when the template was last updated.
  /// 模板最后更新时间。
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