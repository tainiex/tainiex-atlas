/// Payload for creating a new chat session.
/// 创建新聊天会话的请求体。
/// 
/// API: `POST /api/chat/sessions`
class CreateSessionDto {

  CreateSessionDto({
  });

  factory CreateSessionDto.fromJson(Map<String, dynamic> json) {
    return CreateSessionDto(
    );
  }
  Map<String, dynamic> toJson() {
    return {
    };
  }
}