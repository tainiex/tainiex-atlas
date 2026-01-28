use serde::{Serialize, Deserialize};

/// Payload for chat:error event.
/// 一般性 WebSocket 错误事件 Payload。
/// 
/// Event: `socket.on('chat:error', (payload: ChatErrorPayload) => { ... })`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatErrorPayload {
/// The error message / 错误信息。
    pub error: String,
}