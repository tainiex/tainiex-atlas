class CollaborationLimitPayload {
  final String error;
  final num currentEditors;
  final num maxEditors;

  CollaborationLimitPayload({
    required this.error,
    required this.currentEditors,
    required this.maxEditors,
  });

  factory CollaborationLimitPayload.fromJson(Map<String, dynamic> json) {
    return CollaborationLimitPayload(
      error: json['error'] as String,
      currentEditors: json['currentEditors'] as num,
      maxEditors: json['maxEditors'] as num,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'error': this.error,
      'currentEditors': this.currentEditors,
      'maxEditors': this.maxEditors,
    };
  }
}