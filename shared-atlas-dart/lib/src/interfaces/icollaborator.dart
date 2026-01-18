class ICollaborator {
  final String userId;
  final String username;
  final String? avatar;
  final String color;
  final dynamic cursorPosition;
  final dynamic selection;

  ICollaborator({
    required this.userId,
    required this.username,
    this.avatar,
    required this.color,
    this.cursorPosition,
    this.selection,
  });

  factory ICollaborator.fromJson(Map<String, dynamic> json) {
    return ICollaborator(
      userId: json['userId'] as String,
      username: json['username'] as String,
      avatar: json['avatar'] as String?,
      color: json['color'] as String,
      cursorPosition: json['cursorPosition'] as dynamic,
      selection: json['selection'] as dynamic,
    );
  }
  Map<String, dynamic> toJson() {
    return {
      'userId': this.userId,
      'username': this.username,
      'avatar': this.avatar,
      'color': this.color,
      'cursorPosition': this.cursorPosition,
      'selection': this.selection,
    };
  }
}