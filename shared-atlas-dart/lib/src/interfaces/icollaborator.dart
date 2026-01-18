/// Represents a collaborator in a note editing session.
/// 代表笔记编辑会话中的协作者。
/// 
/// Used for real-time presence indication.
/// 用于实时在线状态指示。
class ICollaborator {
  /// UUID of the collaborating user.
  /// 协作用户的 UUID。
  final String userId;
  /// Username for display.
  /// 用于显示的用户名。
  final String username;
  /// Optional avatar URL.
  /// 可选的头像URL。
  final String? avatar;
  /// Assigned color for cursor/selection highlight.
  /// 分配的光标/选区高亮颜色。
  final String color;
  /// Current cursor position.
  /// 当前光标位置。
  final dynamic cursorPosition;
  /// Current text selection range.
  /// 当前文本选区范围。
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