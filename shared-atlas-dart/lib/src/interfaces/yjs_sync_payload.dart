/// Payload for Y.js initial sync.
/// Y.js 初始同步的 Payload。
/// 
/// Event: `server.emit('yjs:sync', payload)`
class YjsSyncPayload {
  /// Note ID / 笔记ID
  final String noteId;
  /// Y.js update data (base64) / Y.js 更新数据
  final String update;
  /// State vector (base64) / 状态向量
  final String stateVector;

  YjsSyncPayload({
    required this.noteId,
    required this.update,
    required this.stateVector,
  });

  factory YjsSyncPayload.fromJson(Map<String, dynamic> json) {
    return YjsSyncPayload(
      noteId: json['noteId'] as String,
      update: json['update'] as String,
      stateVector: json['stateVector'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'noteId': this.noteId,
      'update': this.update,
      'stateVector': this.stateVector,
    };
  }
}