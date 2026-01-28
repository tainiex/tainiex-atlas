use serde::{Serialize, Deserialize};
use serde_json;

/// Payload for cursor position update.
/// 光标位置更新的 Payload。
/// 
/// Event: `client.emit('cursor:update', payload)`
/// Event: `server.emit('cursor:update', payload)`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorUpdatePayload {
/// Note ID.
/// 笔记ID。
    pub note_id: String,
/// Current cursor position.
/// 当前光标位置。
    pub position: Option<serde_json::Value>,
/// Current selection range.
/// 当前选区范围。
    pub selection: Option<serde_json::Value>,
}