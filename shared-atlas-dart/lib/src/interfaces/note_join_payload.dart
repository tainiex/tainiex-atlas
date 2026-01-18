/// Payload for joining a note editing session.
/// 加入笔记编辑会话的 Payload。
/// 
/// Event: `client.emit('note:join', payload)`
class NoteJoinPayload {
  /// Note ID to join.
  /// 要加入的笔记ID。
  final String noteId;

  NoteJoinPayload({
    required this.noteId,
  });

  factory NoteJoinPayload.fromJson(Map<String, dynamic> json) {
    return NoteJoinPayload(
      noteId: json['noteId'] as String,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'noteId': this.noteId,
    };
  }
}