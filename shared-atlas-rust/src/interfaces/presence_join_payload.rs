use serde::{Serialize, Deserialize};

/// Event when a user joins the collaboration session.
/// 用户加入协作会话时的事件。
/// 
/// Event: `server.emit('presence:join', payload)`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceJoinPayload {
/// User ID / 用户ID
    pub user_id: String,
/// Username / 用户名
    pub username: String,
/// User avatar URL / 用户头像URL
    pub avatar: Option<String>,
/// Assigned color / 分配的颜色
    pub color: String,
}