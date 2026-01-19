use serde::{Serialize, Deserialize};

/// Payload for joining a note editing session.
/// 加入笔记编辑会话的 Payload。
/// 
/// Event: `client.emit('note:join', payload)`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteJoinPayload {
/// Note ID to join.
/// 要加入的笔记ID。
    pub note_id: String,
}