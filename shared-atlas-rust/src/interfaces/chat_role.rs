use serde::{Serialize, Deserialize};

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
    User,
    #[serde(rename = "assistant")]
    Assistant,
}