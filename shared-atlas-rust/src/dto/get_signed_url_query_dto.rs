use serde::{Serialize, Deserialize};

/// Get Signed URL Query DTO
/// 获取签名 URL 查询 DTO
/// 
/// Request a fresh signed URL for an existing GCS path.
/// 为现有 GCS 路径请求新的签名 URL。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSignedUrlQueryDto {
/// Internal GCS path
/// 内部 GCS 路径
    pub path: String,
/// Optional expiration time in seconds
/// 可选的过期时间（秒）
    pub expiration_seconds: Option<i32>,
}