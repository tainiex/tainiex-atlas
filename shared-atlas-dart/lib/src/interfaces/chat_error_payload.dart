class ChatErrorPayload {
  final String error;

  ChatErrorPayload({
    required this.error,
  });

  factory ChatErrorPayload.fromJson(Map<String, dynamic> json) {
    return ChatErrorPayload(
      error: json['error'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'error': this.error,
    };
  }
}