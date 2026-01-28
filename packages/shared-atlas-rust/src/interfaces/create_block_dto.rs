use serde::{Serialize, Deserialize};
use crate::interfaces::block_type::BlockType;
use serde_json;

/// Payload for creating a new block.
/// 创建新块的请求体。
/// 
/// API: `POST /api/notes/:noteId/blocks`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBlockDto {
/// Type of the block.
/// 块的类型。
    pub r#type: BlockType,
/// Content of the block.
/// 块的内容。
    pub content: String,
/// Optional metadata.
/// 可选的元数据。
    pub metadata: Option<serde_json::Value>,
/// Optional parent block ID.
/// 可选的父块ID。
    pub parent_block_id: Option<String>,
/// Optional position (defaults to end).
/// 可选的位置（默认为末尾）。
    pub position: Option<f64>,
}