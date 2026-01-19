use serde::{Serialize, Deserialize};
use crate::interfaces::chat_message_response::ChatMessageResponse;

/// Response structure for fetching messages.
/// 获取消息的响应结构。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetMessagesResponse {
/// List of messages.
/// 消息列表。
    pub messages: Vec<ChatMessageResponse>,
/// Whether there are more older messages available.
/// 是否还有更多旧消息。
    pub has_more: bool,
/// Cursor for the next page requests (use as 'before' param).
/// 下一页请求的游标（作为 'before' 参数使用）。
    pub next_cursor: String,
}