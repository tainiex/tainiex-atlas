use serde::{Serialize, Deserialize};

/// Payload for creating a new note.
/// 创建新笔记的请求体。
/// 
/// API: `POST /api/notes`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteDto {
/// Title of the note.
/// 笔记标题。
    pub title: String,
/// Optional template ID to create from.
/// 可选的模板ID。
    pub template_id: Option<String>,
/// Optional parent note ID.
/// 可选的父笔记ID。
    pub parent_id: Option<String>,
}