use serde::{Serialize, Deserialize};

/// Payload for leaving a note editing session.
/// 离开笔记编辑会话的 Payload。
/// 
/// Event: `client.emit('note:leave', payload)`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteLeavePayload {
/// Note ID to leave.
/// 要离开的笔记ID。
    pub note_id: String,
}