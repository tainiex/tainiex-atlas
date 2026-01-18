/// Payload for cursor position update.
/// 光标位置更新的 Payload。
/// 
/// Event: `client.emit('cursor:update', payload)`
/// Event: `server.emit('cursor:update', payload)`
class CursorUpdatePayload {
  /// Note ID.
  /// 笔记ID。
  final String noteId;
  /// Current cursor position.
  /// 当前光标位置。
  final dynamic position;
  /// Current selection range.
  /// 当前选区范围。
  final dynamic selection;

  CursorUpdatePayload({
    required this.noteId,
    this.position,
    this.selection,
  });

  factory CursorUpdatePayload.fromJson(Map<String, dynamic> json) {
    return CursorUpdatePayload(
      noteId: json['noteId'] as String,
      position: json['position'] as dynamic,
      selection: json['selection'] as dynamic,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'noteId': this.noteId,
      'position': this.position,
      'selection': this.selection,
    };
  }
}