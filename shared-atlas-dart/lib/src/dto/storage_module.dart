enum StorageModule {
  // @JsonValue('notes')
  NOTES('notes'),
  // @JsonValue('chats')
  CHAT('chats');

  final String value;
  const StorageModule(this.value);

  factory StorageModule.fromJson(dynamic json) {
    return StorageModule.values.firstWhere((e) => e.value == json.toString(), orElse: () => StorageModule.values.first);
  }

  String toJson() => value;
}