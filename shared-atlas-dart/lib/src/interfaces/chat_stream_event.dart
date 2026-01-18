class ChatStreamEvent {
  final dynamic type;
  final String? data;
  final String? error;
  final String? title;

  ChatStreamEvent({
    required this.type,
    this.data,
    this.error,
    this.title,
  });

  factory ChatStreamEvent.fromJson(Map<String, dynamic> json) {
    return ChatStreamEvent(
      type: json['type'] as dynamic,
      data: json['data'] as String?,
      error: json['error'] as String?,
      title: json['title'] as String?,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'type': this.type,
      'data': this.data,
      'error': this.error,
      'title': this.title,
    };
  }
}