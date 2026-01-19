use serde::{Serialize, Deserialize};
use crate::dto::storage_module::StorageModule;

/// Upload File Query DTO
/// 上传文件查询 DTO
/// 
/// Validates query parameters for file upload endpoint.
/// 验证文件上传端点的查询参数。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadFileQueryDto {
/// Module prefix for directory separation
/// 目录分离的模块前缀
    pub module: Option<StorageModule>,
/// Target folder within the module
/// 模块内的目标文件夹
    pub folder: Option<String>,
}