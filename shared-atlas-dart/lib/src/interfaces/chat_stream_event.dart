/// Stream event from server to client.
/// 服务端发送给客户端的流式事件。
/// 
/// Event: `socket.on('chat:stream', (event: ChatStreamEvent) => { ... })`
class ChatStreamEvent {
  /// Event type:
  /// - `chunk`: A piece of the generated text. (生成的一段文本)
  /// - `done`: Generation completed. (生成完成)
  /// - `error`: An error occurred. (发生错误)
  final dynamic type;
  /// Text data for `chunk` events.
  /// 当 type='chunk' 时，包含文本片段。
  final String? data;
  /// Error message for `error` events.
  /// 当 type='error' 时，包含错误信息。
  final String? error;
  /// Optional updated session title.
  /// Sent with 'done' event if the title was updated or requested.
  /// 发送 'done' 事件时可能包含的更新后的会话标题。
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