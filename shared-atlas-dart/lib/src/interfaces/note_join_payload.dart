class NoteJoinPayload {
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