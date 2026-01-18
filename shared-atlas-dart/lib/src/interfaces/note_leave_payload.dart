/// Payload for leaving a note editing session.
/// 离开笔记编辑会话的 Payload。
/// 
/// Event: `client.emit('note:leave', payload)`
class NoteLeavePayload {
  /// Note ID to leave.
  /// 要离开的笔记ID。
  final String noteId;

  NoteLeavePayload({
    required this.noteId,
  });

  factory NoteLeavePayload.fromJson(Map<String, dynamic> json) {
    return NoteLeavePayload(
      noteId: json['noteId'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'noteId': this.noteId,
    };
  }
}