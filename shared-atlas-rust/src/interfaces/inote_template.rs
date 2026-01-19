use serde::{Serialize, Deserialize};
use serde_json;

/// Represents a note template.
/// 代表笔记模板。
/// 
/// Related APIs / 相关接口:
/// - `GET /api/templates`: Returns available templates.
/// - `POST /api/notes/from-template/:templateId`: Creates note from template.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct INoteTemplate {
/// Unique UUID of the template.
/// 模板的唯一 UUID。
    pub id: String,
/// Template name.
/// 模板名称。
    pub name: String,
/// Optional description.
/// 可选的描述。
    pub description: Option<String>,
/// Optional thumbnail URL.
/// 可选的缩略图URL。
    pub thumbnail: Option<String>,
/// Category (e.g., 'meeting', 'project', 'doc').
/// 分类（如：'meeting'、'project'、'doc'）。
    pub category: String,
/// Whether this is a public/system template.
/// 是否为公共/系统模板。
    pub is_public: bool,
/// Optional creator user ID (null for system templates).
/// 可选的创建者用户ID（系统模板为null）。
    pub created_by: Option<String>,
/// Template structure (array of block definitions).
/// 模板结构（块定义数组）。
    pub template_data: serde_json::Value,
/// Number of times this template has been used.
/// 此模板被使用的次数。
    pub usage_count: f64,
/// Timestamp when the template was created.
/// 模板创建时间。
    pub created_at: chrono::DateTime<chrono::Utc>,
/// Timestamp when the template was last updated.
/// 模板最后更新时间。
    pub updated_at: chrono::DateTime<chrono::Utc>,
}