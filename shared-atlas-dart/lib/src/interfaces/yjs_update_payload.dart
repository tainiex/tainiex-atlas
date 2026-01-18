/// Payload for Y.js update synchronization.
/// Y.js 更新同步的 Payload。
/// 
/// Event: `client.emit('yjs:update', payload)`
/// Event: `server.emit('yjs:update', payload)`
class YjsUpdatePayload {
  /// Note ID.
  /// 笔记ID。
  final String noteId;
  /// Y.js update data (Uint8Array encoded as base64 for JSON transport).
  /// Y.js 更新数据（Uint8Array编码为base64用于JSON传输）。
  final String update;

  YjsUpdatePayload({
    required this.noteId,
    required this.update,
  });

  factory YjsUpdatePayload.fromJson(Map<String, dynamic> json) {
    return YjsUpdatePayload(
      noteId: json['noteId'] as String,
      update: json['update'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'noteId': this.noteId,
      'update': this.update,
    };
  }
}