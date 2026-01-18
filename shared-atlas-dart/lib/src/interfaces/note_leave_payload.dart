class NoteLeavePayload {
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