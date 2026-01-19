class WsMessageAckPayload {
  final String messageId;

  WsMessageAckPayload({
    required this.messageId,
  });

  factory WsMessageAckPayload.fromJson(Map<String, dynamic> json) {
    return WsMessageAckPayload(
      messageId: json['messageId'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'messageId': this.messageId,
    };
  }
}