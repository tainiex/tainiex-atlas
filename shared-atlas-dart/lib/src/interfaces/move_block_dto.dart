/// Payload for moving a block.
/// 移动块的请求体。
/// 
/// API: `POST /api/blocks/:id/move`
class MoveBlockDto {
  /// New position index.
  /// 新的位置索引。
  final num position;
  /// Optional new parent block ID.
  /// 可选的新父块ID。
  final String? parentBlockId;

  MoveBlockDto({
    required this.position,
    this.parentBlockId,
  });

  factory MoveBlockDto.fromJson(Map<String, dynamic> json) {
    return MoveBlockDto(
      position: json['position'] as num,
      parentBlockId: json['parentBlockId'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'position': this.position,
      'parentBlockId': this.parentBlockId,
    };
  }
}