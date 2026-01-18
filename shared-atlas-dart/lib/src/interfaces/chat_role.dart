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