use serde::{Serialize, Deserialize};
use crate::interfaces::chat_role::ChatRole;

/// Payload for sending a message via WebSocket.
/// 通过 WebSocket 发送消息的 Payload。
/// 
/// Event: `client.emit('chat:send', payload)`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSendPayload {
/// Session ID to send the message to.
/// 目标会话 ID。
    pub session_id: String,
/// Message content.
/// 消息内容。
    pub content: String,
/// Optional role (defaults to USER).
/// 角色（可选，默认 USER）。
    pub role: Option<ChatRole>,
/// Optional model to use for response generation.
/// 指定模型（可选）。
    pub model: Option<String>,
/// Optional parent ID.
/// 父消息 ID (可选).
    pub parent_id: Option<String>,
}