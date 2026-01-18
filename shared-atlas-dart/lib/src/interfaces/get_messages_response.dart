import 'package:shared_atlas_dart/shared_atlas_dart.dart';

/// Response structure for fetching messages.
/// 获取消息的响应结构。
class GetMessagesResponse {
  /// List of messages.
  /// 消息列表。
  final List<ChatMessageResponse> messages;
  /// Whether there are more older messages available.
  /// 是否还有更多旧消息。
  final bool hasMore;
  /// Cursor for the next page requests (use as 'before' param).
  /// 下一页请求的游标（作为 'before' 参数使用）。
  final String nextCursor;

  GetMessagesResponse({
    required this.messages,
    required this.hasMore,
    required this.nextCursor,
  });

  factory GetMessagesResponse.fromJson(Map<String, dynamic> json) {
    return GetMessagesResponse(
      messages: (json['messages'] as List<dynamic>).map((e) => ChatMessageResponse.fromJson(e as Map<String, dynamic>)).toList(),
      hasMore: json['hasMore'] as bool,
      nextCursor: json['nextCursor'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'messages': this.messages.map((e) => e.toJson()).toList(),
      'hasMore': this.hasMore,
      'nextCursor': this.nextCursor,
    };
  }
}