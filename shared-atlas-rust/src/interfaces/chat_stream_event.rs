use serde::{Serialize, Deserialize};
use serde_json;

/// Stream event from server to client.
/// 服务端发送给客户端的流式事件。
/// 
/// Event: `socket.on('chat:stream', (event: ChatStreamEvent) => { ... })`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatStreamEvent {
/// Event type:
/// - `chunk`: A piece of the generated text. (生成的一段文本)
/// - `done`: Generation completed. (生成完成)
/// - `error`: An error occurred. (发生错误)
    pub r#type: serde_json::Value,
/// Text data for `chunk` events.
/// 当 type='chunk' 时，包含文本片段。
    pub data: Option<String>,
/// Error message for `error` events.
/// 当 type='error' 时，包含错误信息。
    pub error: Option<String>,
/// Optional updated session title.
/// Sent with 'done' event if the title was updated or requested.
/// 发送 'done' 事件时可能包含的更新后的会话标题。
    pub title: Option<String>,
}