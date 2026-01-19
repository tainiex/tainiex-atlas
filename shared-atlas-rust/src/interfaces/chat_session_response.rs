use serde::{Serialize, Deserialize};
use crate::interfaces::ichat_session::IChatSession;

/// API response structure for a chat session.
/// Match of IChatSession for now.
/// 聊天会话的 API 响应结构，目前与 IChatSession 一致。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSessionResponse {
/// Unique UUID of the session.
/// 会话的唯一 UUID。
    pub id: String,
/// UUID of the user who owns this session.
/// 拥有此会话的用户的 UUID。
    pub user_id: String,
/// Auto-generated title of the conversation.
/// Usually summarized from the first message.
/// 会话标题，通常由第一条消息自动总结生成。
    pub title: String,
/// Timestamp when the session was created.
/// 会话创建时间。
    pub created_at: chrono::DateTime<chrono::Utc>,
/// Timestamp when the last message was added or session updated.
/// 会话最后更新时间（如有新消息）。
    pub updated_at: chrono::DateTime<chrono::Utc>,
}