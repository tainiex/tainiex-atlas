use serde::{Serialize, Deserialize};

/// Enum defining the type of a content block in a note.
/// 定义笔记中内容块的类型。
/// 
/// Usage / 使用场景:
/// - `IBlock.type`
/// - `CreateBlockDto.type`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BlockType {
    #[serde(rename = "TEXT")]
    Text,
    #[serde(rename = "HEADING1")]
    Heading1,
    #[serde(rename = "HEADING2")]
    Heading2,
    #[serde(rename = "HEADING3")]
    Heading3,
    #[serde(rename = "BULLET_LIST")]
    BulletList,
    #[serde(rename = "NUMBERED_LIST")]
    NumberedList,
    #[serde(rename = "TODO_LIST")]
    TodoList,
    #[serde(rename = "TODO_ITEM")]
    TodoItem,
    #[serde(rename = "TABLE")]
    Table,
    #[serde(rename = "CODE")]
    Code,
    #[serde(rename = "IMAGE")]
    Image,
    #[serde(rename = "VIDEO")]
    Video,
    #[serde(rename = "FILE")]
    File,
    #[serde(rename = "DIVIDER")]
    Divider,
    #[serde(rename = "QUOTE")]
    Quote,
    #[serde(rename = "CALLOUT")]
    Callout,
    #[serde(rename = "TOGGLE")]
    Toggle,
}