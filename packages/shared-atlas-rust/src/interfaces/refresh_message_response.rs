use serde::{Serialize, Deserialize};

/// Refresh Token Response for Web
/// Web clients receive a simple message confirmation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshMessageResponse {
    pub message: String,
}