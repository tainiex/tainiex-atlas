use serde::{Serialize, Deserialize};
use crate::interfaces::ichat_message::IChatMessage;
use crate::interfaces::add_message_dto::AddMessageDto;
use crate::interfaces::chat_send_payload::ChatSendPayload;

/// Enum defining the role of the message sender in a chat session.
/// 定义聊天会话中消息发送者的角色。
/// 
/// Usage / 使用场景:
/// - `IChatMessage.role`
/// - `ChatSendPayload.role`
/// - `AddMessageDto.role`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChatRole {
    #[serde(rename = "user")]
    USER,
    #[serde(rename = "assistant")]
    ASSISTANT,
}