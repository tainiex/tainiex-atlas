class MoveBlockDto {
  final num position;
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