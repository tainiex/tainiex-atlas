use serde::{Serialize, Deserialize};

/// Payload for Y.js update synchronization.
/// Y.js 更新同步的 Payload。
/// 
/// Event: `client.emit('yjs:update', payload)`
/// Event: `server.emit('yjs:update', payload)`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YjsUpdatePayload {
/// Note ID.
/// 笔记ID。
    pub note_id: String,
/// Y.js update data (Uint8Array encoded as base64 for JSON transport).
/// Y.js 更新数据（Uint8Array编码为base64用于JSON传输）。
    pub update: String,
}