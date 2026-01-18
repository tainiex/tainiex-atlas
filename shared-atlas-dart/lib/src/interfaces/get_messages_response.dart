import 'package:shared_atlas_dart/shared_atlas_dart.dart';

class GetMessagesResponse {
  final List<ChatMessageResponse> messages;
  final bool hasMore;
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