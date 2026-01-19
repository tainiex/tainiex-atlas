use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebSocketErrorCode {
    #[serde(rename = "4010")]
    AUTH_TOKEN_MISSING,
    #[serde(rename = "4011")]
    AUTH_TOKEN_INVALID,
    #[serde(rename = "4012")]
    AUTH_TOKEN_EXPIRED,
    #[serde(rename = "4030")]
    PERMISSION_DENIED,
    #[serde(rename = "4031")]
    RATE_LIMIT_EXCEEDED,
    #[serde(rename = "4032")]
    CONCURRENT_LIMIT_REACHED,
    #[serde(rename = "4220")]
    INVALID_PAYLOAD,
    #[serde(rename = "4221")]
    NOTE_NOT_FOUND,
    #[serde(rename = "4222")]
    SESSION_NOT_FOUND,
    #[serde(rename = "5000")]
    INTERNAL_ERROR,
    #[serde(rename = "5001")]
    DATABASE_ERROR,
    #[serde(rename = "5002")]
    YJS_SYNC_FAILED,
}