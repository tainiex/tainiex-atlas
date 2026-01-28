use serde::{Serialize, Deserialize};

/// Signed URL Response
/// 签名 URL 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ISignedUrlResponse {
/// New signed URL
/// 新签名 URL
    pub url: String,
/// GCS path (for verification)
/// GCS 路径（用于验证）
    pub path: String,
/// URL expiration timestamp (Unix milliseconds)
/// URL 过期时间戳（Unix 毫秒）
    pub expires_at: f64,
/// Seconds until expiration
/// 距离过期的秒数
    pub expires_in: f64,
}