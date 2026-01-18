/// Enum defining the role of the message sender in a chat session.
/// 定义聊天会话中消息发送者的角色。
/// 
/// Usage / 使用场景:
/// - `IChatMessage.role`
/// - `ChatSendPayload.role`
/// - `AddMessageDto.role`
enum ChatRole {
  // @JsonValue('user')
  USER('user'),
  // @JsonValue('assistant')
  ASSISTANT('assistant');

  final String value;
  const ChatRole(this.value);

  factory ChatRole.fromJson(dynamic json) {
    return ChatRole.values.firstWhere((e) => e.value == json.toString(), orElse: () => ChatRole.values.first);
  }

  String toJson() => value;
}