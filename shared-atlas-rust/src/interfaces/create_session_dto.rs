use serde::{Serialize, Deserialize};

/// Payload for creating a new chat session.
/// 创建新聊天会话的请求体。
/// 
/// API: `POST /api/chat/sessions`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionDto {
}