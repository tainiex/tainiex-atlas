use serde::{Serialize, Deserialize};
use serde_json;

/// Storage Interfaces
/// 存储接口
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IFileUploadResponse {
/// Success status
/// 成功状态
    pub success: bool,
/// Signed URL for immediate access (valid for limited time)
/// 用于立即访问的签名 URL（有时限）
    pub url: String,
/// Internal GCS path (store this in DB)
/// 内部 GCS 路径（存储在数据库中）
    pub path: String,
/// URL expiration timestamp (Unix milliseconds)
/// URL 过期时间戳（Unix 毫秒）
    pub expires_at: Option<f64>,
/// File metadata
/// 文件元数据
    pub metadata: serde_json::Value,
}