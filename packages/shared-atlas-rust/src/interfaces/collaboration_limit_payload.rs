use serde::{Serialize, Deserialize};

/// Event when max concurrent editors limit is reached.
/// 达到最大并发编辑人数限制时的事件。
/// 
/// Event: `server.emit('collaboration:limit', payload)`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollaborationLimitPayload {
/// Error message / 错误消息
    pub error: String,
/// Current editor count / 当前编辑者数量
    pub current_editors: f64,
/// Maximum allowed editors / 最大允许编辑者数量
    pub max_editors: f64,
}