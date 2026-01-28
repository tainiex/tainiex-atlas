use serde::{Serialize, Deserialize};

/// Storage Module Enum
/// 存储模块枚举
/// 
/// Defines valid module prefixes for file organization.
/// 定义文件组织的有效模块前缀。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StorageModule {
    #[serde(rename = "notes")]
    Notes,
    #[serde(rename = "chats")]
    Chat,
}