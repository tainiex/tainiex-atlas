use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebSocketErrorCode {
    #[serde(rename = "4010")]
    AuthTokenMissing,
    #[serde(rename = "4011")]
    AuthTokenInvalid,
    #[serde(rename = "4012")]
    AuthTokenExpired,
    #[serde(rename = "4030")]
    PermissionDenied,
    #[serde(rename = "4031")]
    RateLimitExceeded,
    #[serde(rename = "4032")]
    ConcurrentLimitReached,
    #[serde(rename = "4220")]
    InvalidPayload,
    #[serde(rename = "4221")]
    NoteNotFound,
    #[serde(rename = "4222")]
    SessionNotFound,
    #[serde(rename = "5000")]
    InternalError,
    #[serde(rename = "5001")]
    DatabaseError,
    #[serde(rename = "5002")]
    YjsSyncFailed,
}