use serde::{Serialize, Deserialize};
use crate::interfaces::chat_role::ChatRole;

/// Payload for adding a new message to a session via REST API.
/// 通过 REST API 向会话添加新消息的请求体。
/// 
/// API: `POST /api/chat/sessions/:id/messages`
/// Note: This endpoint now supports Streaming responses (Server-Sent Events / Chunked Transfer).
/// 注意：此接口现在支持流式响应。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddMessageDto {
/// The text content of the message to send.
/// 发送的消息内容。
    pub content: String,
/// Optional role of the sender.
/// Defaults to 'user' if not specified.
/// 发送者角色，默认为 'user'。
    pub role: Option<ChatRole>,
/// Optional model to use for generating response.
/// If not provided, defaults to the system default model.
/// 指定用于生成的模型 ID。如不填则使用系统默认模型。
    pub model: Option<String>,
/// Optional parent ID.
/// 可选的父消息 ID。
    pub parent_id: Option<String>,
}