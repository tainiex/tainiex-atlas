use serde::{Serialize, Deserialize};
use crate::interfaces::iblock::IBlock;
use crate::interfaces::create_block_dto::CreateBlockDto;

/// Enum defining the type of a content block in a note.
/// 定义笔记中内容块的类型。
/// 
/// Usage / 使用场景:
/// - `IBlock.type`
/// - `CreateBlockDto.type`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BlockType {
    TEXT,
    HEADING1,
    HEADING2,
    HEADING3,
    BULLET_LIST,
    NUMBERED_LIST,
    TODO_LIST,
    TODO_ITEM,
    TABLE,
    CODE,
    IMAGE,
    VIDEO,
    FILE,
    DIVIDER,
    QUOTE,
    CALLOUT,
    TOGGLE,
}