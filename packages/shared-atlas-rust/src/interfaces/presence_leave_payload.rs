use serde::{Serialize, Deserialize};

/// Event when a user leaves the collaboration session.
/// 用户离开协作会话时的事件。
/// 
/// Event: `server.emit('presence:leave', payload)`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceLeavePayload {
/// User ID / 用户ID
    pub user_id: String,
}