use serde::{Serialize, Deserialize};

/// Payload for moving a block.
/// 移动块的请求体。
/// 
/// API: `POST /api/blocks/:id/move`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveBlockDto {
/// New position index.
/// 新的位置索引。
    pub position: f64,
/// Optional new parent block ID.
/// 可选的新父块ID。
    pub parent_block_id: Option<String>,
}