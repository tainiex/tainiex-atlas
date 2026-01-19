use serde::{Serialize, Deserialize};
use serde_json;

/// Represents a collaborator in a note editing session.
/// 代表笔记编辑会话中的协作者。
/// 
/// Used for real-time presence indication.
/// 用于实时在线状态指示。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ICollaborator {
/// UUID of the collaborating user.
/// 协作用户的 UUID。
    pub user_id: String,
/// Username for display.
/// 用于显示的用户名。
    pub username: String,
/// Optional avatar URL.
/// 可选的头像URL。
    pub avatar: Option<String>,
/// Assigned color for cursor/selection highlight.
/// 分配的光标/选区高亮颜色。
    pub color: String,
/// Current cursor position.
/// 当前光标位置。
    pub cursor_position: Option<serde_json::Value>,
/// Current text selection range.
/// 当前文本选区范围。
    pub selection: Option<serde_json::Value>,
}