import 'package:shared_atlas_dart/shared_atlas_dart.dart';

class SearchResultDto {
  final List<INote> notes;
  final List<dynamic> blocks;
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