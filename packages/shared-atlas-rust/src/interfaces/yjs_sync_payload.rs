use serde::{Serialize, Deserialize};

/// Payload for Y.js initial sync.
/// Y.js 初始同步的 Payload。
/// 
/// Event: `server.emit('yjs:sync', payload)`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YjsSyncPayload {
/// Note ID / 笔记ID
    pub note_id: String,
/// Y.js update data (base64) / Y.js 更新数据
    pub update: String,
/// State vector (base64) / 状态向量
    pub state_vector: String,
}