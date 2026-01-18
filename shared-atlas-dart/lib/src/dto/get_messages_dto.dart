class GetMessagesDto {
  final int? limit;
  final String? before;
  final String? leafMessageId;

  GetMessagesDto({
    this.limit,
    this.before,
    this.leafMessageId,
  });

  factory GetMessagesDto.fromJson(Map<String, dynamic> json) {
    return GetMessagesDto(
      limit: json['limit'] as int?,
      before: json['before'] as String?,
      leafMessageId: json['leafMessageId'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'limit': this.limit,
      'before': this.before,
      'leafMessageId': this.leafMessageId,
    };
  }
}