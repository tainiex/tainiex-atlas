use serde::{Serialize, Deserialize};
use crate::interfaces::inote::INote;
use serde_json;

/// API response for search results.
/// 搜索结果的 API 响应。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultDto {
/// Matching notes.
/// 匹配的笔记。
    pub notes: Vec<INote>,
/// Matching blocks with highlight info.
/// 匹配的块及高亮信息。
    pub blocks: Vec<serde_json::Value>,
/// Total count of results.
/// 结果总数。
    pub total: f64,
}