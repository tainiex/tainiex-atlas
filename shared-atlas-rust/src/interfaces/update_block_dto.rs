use serde::{Serialize, Deserialize};
use serde_json;

/// Payload for updating a block.
/// 更新块的请求体。
/// 
/// API: `PATCH /api/blocks/:id`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBlockDto {
/// Optional new content.
/// 可选的新内容。
    pub content: Option<String>,
/// Optional new metadata.
/// 可选的新元数据。
    pub metadata: Option<serde_json::Value>,
}