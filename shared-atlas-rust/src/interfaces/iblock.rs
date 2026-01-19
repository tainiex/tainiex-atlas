use serde::{Serialize, Deserialize};
use crate::interfaces::block_type::BlockType;
use serde_json;

/// Represents a content block within a note.
/// 代表笔记中的一个内容块。
/// 
/// Related APIs / 相关接口:
/// - `GET /api/notes/:noteId/blocks`: Returns all blocks of a note.
/// - `POST /api/notes/:noteId/blocks`: Creates a new block.
/// - `PATCH /api/blocks/:id`: Updates a block.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IBlock {
/// Unique UUID of the block.
/// 块的唯一 UUID。
    pub id: String,
/// UUID of the note this block belongs to.
/// 此块所属笔记的 UUID。
    pub note_id: String,
/// Type of the block (text, heading, image, etc.).
/// 块的类型（文本、标题、图片等）。
    pub r#type: BlockType,
/// Plain text content or serialized content.
/// For images/videos/files, this is the GCS URL.
/// 纯文本内容或序列化内容。
/// 对于图片/视频/文件，这是GCS URL。
    pub content: String,
/// Type-specific metadata (JSON object).
/// Examples: table structure, code language, file info.
/// 块类型特定的元数据（JSON对象）。
/// 示例：表格结构、代码语言、文件信息。
    pub metadata: serde_json::Value,
/// Optional parent block ID for nested structures.
/// 可选的父块ID，用于嵌套结构。
    pub parent_block_id: Option<String>,
/// Position/order within parent (0-indexed).
/// 在父级中的位置/顺序（从0开始）。
    pub position: f64,
/// Timestamp when the block was created.
/// 块创建时间。
    pub created_at: chrono::DateTime<chrono::Utc>,
/// Timestamp when the block was last updated.
/// 块最后更新时间。
    pub updated_at: chrono::DateTime<chrono::Utc>,
/// UUID of the user who created this block.
/// 创建此块的用户UUID。
    pub created_by: String,
/// UUID of the user who last edited this block.
/// 最后编辑此块的用户UUID。
    pub last_edited_by: String,
/// Optional nested children blocks (for tree structure rendering).
/// 可选的嵌套子块（用于树状结构渲染）。
    pub children: Option<Vec<IBlock>>,
/// Optional soft delete flag.
/// 可选的软删除标记。
    pub is_deleted: Option<bool>,
}