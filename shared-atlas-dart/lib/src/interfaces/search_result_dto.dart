import 'package:shared_atlas_dart/shared_atlas_dart.dart';

/// API response for search results.
/// 搜索结果的 API 响应。
class SearchResultDto {
  /// Matching notes.
  /// 匹配的笔记。
  final List<INote> notes;
  /// Matching blocks with highlight info.
  /// 匹配的块及高亮信息。
  final List<dynamic> blocks;
  /// Total count of results.
  /// 结果总数。
  final num total;

  SearchResultDto({
    required this.notes,
    required this.blocks,
    required this.total,
  });

  factory SearchResultDto.fromJson(Map<String, dynamic> json) {
    return SearchResultDto(
      notes: (json['notes'] as List<dynamic>).map((e) => INote.fromJson(e as Map<String, dynamic>)).toList(),
      blocks: (json['blocks'] as List<dynamic>).toList(),
      total: json['total'] as num,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'notes': this.notes.map((e) => e.toJson()).toList(),
      'blocks': this.blocks,
      'total': this.total,
    };
  }
}