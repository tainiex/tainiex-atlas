class ChatSessionResponse {
  final String id;
  final String userId;
  final String title;
  final DateTime createdAt;
  final DateTime updatedAt;

  ChatSessionResponse({
    required this.id,
    required this.userId,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ChatSessionResponse.fromJson(Map<String, dynamic> json) {
    return ChatSessionResponse(
      id: json['id'] as String,
      userId: json['userId'] as String,
      title: json['title'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'id': this.id,
      'userId': this.userId,
      'title': this.title,
      'createdAt': this.createdAt.toIso8601String(),
      'updatedAt': this.updatedAt.toIso8601String(),
    };
  }
}