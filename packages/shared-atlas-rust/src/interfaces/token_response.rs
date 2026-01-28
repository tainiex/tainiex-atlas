use serde::{Serialize, Deserialize};

/// Token Response - Used for refresh token endpoint
/// Contains access and refresh tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenResponse {
    #[serde(rename = "access_token")]
    pub access_token: String,
    #[serde(rename = "refresh_token")]
    pub refresh_token: String,
}