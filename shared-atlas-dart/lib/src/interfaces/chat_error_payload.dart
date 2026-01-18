/// Payload for chat:error event.
/// 一般性 WebSocket 错误事件 Payload。
/// 
/// Event: `socket.on('chat:error', (payload: ChatErrorPayload) => { ... })`
class ChatErrorPayload {
  /// The error message / 错误信息。
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