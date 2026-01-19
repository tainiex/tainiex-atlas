use serde::{Serialize, Deserialize};

/// Payload for updating note metadata.
/// 更新笔记元数据的请求体。
/// 
/// API: `PATCH /api/notes/:id`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoteDto {
/// Optional new title.
/// 可选的新标题。
    pub title: Option<String>,
/// Optional new cover image URL.
/// 可选的新封面图片URL。
    pub cover_image: Option<String>,
/// Optional new icon.
/// 可选的新图标。
    pub icon: Option<String>,
}