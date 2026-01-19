use serde::{Serialize, Deserialize};

/// Represents a chat session or conversation thread.
/// Only metadata is stored here; messages are retrieved separately.
/// 代表一个聊天会话或对话线程。此处仅存储元数据，消息内容需单独获取。
/// 
/// Related APIs / 相关接口:
/// - `GET /api/chat/sessions`: Returns a list of sessions (ChatSession[]).
/// - `GET /api/chat/sessions/:id`: Returns details of a specific session.
/// - `POST /api/chat/sessions`: Creates and returns a new session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IChatSession {
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