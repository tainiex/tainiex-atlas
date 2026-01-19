use serde::{Serialize, Deserialize};
use crate::interfaces::iblock::IBlock;
use serde_json;

/// API response structure for a note with blocks.
/// 包含块的笔记的 API 响应结构。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteWithBlocksResponse {
/// All blocks in this note (tree structure).
/// 此笔记中的所有块（树状结构）。
    pub blocks: Vec<IBlock>,
/// Unique UUID of the note.
/// 笔记的唯一 UUID。
    pub id: String,
/// UUID of the user who owns this note.
/// 拥有此笔记的用户的 UUID。
    pub user_id: String,
/// Title of the note (max 200 characters).
/// 笔记标题（最多200字符）。
    pub title: String,
/// Optional cover image URL (GCS signed URL).
/// 可选的封面图片URL（GCS签名URL）。
    pub cover_image: Option<String>,
/// Optional icon emoji or URL.
/// 可选的图标emoji或URL。
    pub icon: Option<String>,
/// Optional parent note ID for hierarchical structure.
/// 可选的父笔记ID，用于构建层级结构。
    pub parent_id: Option<String>,
/// Whether the note has children (computed property).
/// 笔记是否有子节点（计算属性）。
    pub has_children: Option<bool>,
/// Optional template type used to create this note.
/// 可选的模板类型，用于创建此笔记。
    pub template: Option<String>,
/// Whether the note is publicly accessible.
/// 笔记是否公开可访问。
    pub is_public: bool,
/// Soft delete flag.
/// 软删除标记。
    pub is_deleted: bool,
/// Timestamp when the note was created.
/// 笔记创建时间。
    pub created_at: serde_json::Value,
/// Timestamp when the note was last updated.
/// 笔记最后更新时间。
    pub updated_at: serde_json::Value,
/// UUID of the user who last edited this note.
/// 最后编辑此笔记的用户UUID。
    pub last_edited_by: String,
}