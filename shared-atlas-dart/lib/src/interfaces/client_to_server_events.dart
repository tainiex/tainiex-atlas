class ClientToServerEvents {
  final dynamic note_join;
  final dynamic note_leave;
  final dynamic yjs_update;
  final dynamic cursor_update;

  ClientToServerEvents({
    required this.note_join,
    required this.note_leave,
    required this.yjs_update,
    required this.cursor_update,
  });

  factory ClientToServerEvents.fromJson(Map<String, dynamic> json) {
    return ClientToServerEvents(
      note_join: json['note:join'] as dynamic,
      note_leave: json['note:leave'] as dynamic,
      yjs_update: json['yjs:update'] as dynamic,
      cursor_update: json['cursor:update'] as dynamic,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'note:join': this.note_join,
      'note:leave': this.note_leave,
      'yjs:update': this.yjs_update,
      'cursor:update': this.cursor_update,
    };
  }
}