use serde::{Serialize, Deserialize};
use crate::interfaces::web_socket_error_code::WebSocketErrorCode;
use serde_json;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsErrorResponse {
    pub code: WebSocketErrorCode,
    pub message: String,
    pub category: serde_json::Value,
    pub details: Option<serde_json::Value>,
    pub timestamp: String,
}