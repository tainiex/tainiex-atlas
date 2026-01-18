class CursorUpdatePayload {
  final String noteId;
  final dynamic position;
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