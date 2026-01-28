use serde::{Serialize, Deserialize};
use crate::interfaces::token_response::TokenResponse;

/// Refresh Token Response for Mobile
/// Mobile clients expect tokens wrapped in a tokens object
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshTokenResponse {
    pub tokens: TokenResponse,
}