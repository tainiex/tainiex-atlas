class YjsUpdatePayload {
  final String noteId;
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