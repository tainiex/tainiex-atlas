use serde::{Serialize, Deserialize};
use crate::interfaces::chat_role::ChatRole;

/// Represents a single message within a chat session.
/// 代表聊天会话中的单条消息。
/// 
/// Related APIs / 相关接口:
/// - `GET /api/chat/sessions/:id/messages`: Returns a list of messages (ChatMessage[]).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IChatMessage {
/// Unique UUID of the message.
/// 消息的唯一 UUID。
    pub id: String,
/// UUID of the session this message belongs to.
/// 此消息所属会话的 UUID。
    pub session_id: String,
/// The role of the sender (User or Assistant).
/// 发送者角色（用户或 AI）。
    pub role: ChatRole,
/// The actual text content of the message.
/// 消息的文本内容。
    pub content: String,
/// Timestamp when the message was created.
/// 消息创建时间。
    pub created_at: chrono::DateTime<chrono::Utc>,
/// ID of the parent message.
/// 父消息 ID。
    pub parent_id: String,
}