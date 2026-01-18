/// Event when max concurrent editors limit is reached.
/// 达到最大并发编辑人数限制时的事件。
/// 
/// Event: `server.emit('collaboration:limit', payload)`
class CollaborationLimitPayload {
  /// Error message / 错误消息
  final String error;
  /// Current editor count / 当前编辑者数量
  final num currentEditors;
  /// Maximum allowed editors / 最大允许编辑者数量
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