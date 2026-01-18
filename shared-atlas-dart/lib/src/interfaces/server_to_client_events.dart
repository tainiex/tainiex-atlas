class ServerToClientEvents {
  final dynamic yjs_sync;
  final dynamic yjs_update;
  final dynamic cursor_update;
  final dynamic presence_join;
  final dynamic presence_leave;
  final dynamic presence_list;
  final dynamic collaboration_limit;

  ServerToClientEvents({
    required this.yjs_sync,
    required this.yjs_update,
    required this.cursor_update,
    required this.presence_join,
    required this.presence_leave,
    required this.presence_list,
    required this.collaboration_limit,
  });

  factory ServerToClientEvents.fromJson(Map<String, dynamic> json) {
    return ServerToClientEvents(
      yjs_sync: json['yjs:sync'] as dynamic,
      yjs_update: json['yjs:update'] as dynamic,
      cursor_update: json['cursor:update'] as dynamic,
      presence_join: json['presence:join'] as dynamic,
      presence_leave: json['presence:leave'] as dynamic,
      presence_list: json['presence:list'] as dynamic,
      collaboration_limit: json['collaboration:limit'] as dynamic,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'yjs:sync': this.yjs_sync,
      'yjs:update': this.yjs_update,
      'cursor:update': this.cursor_update,
      'presence:join': this.presence_join,
      'presence:leave': this.presence_leave,
      'presence:list': this.presence_list,
      'collaboration:limit': this.collaboration_limit,
    };
  }
}