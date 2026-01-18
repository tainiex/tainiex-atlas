class YjsSyncPayload {
  final String noteId;
  final String update;
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