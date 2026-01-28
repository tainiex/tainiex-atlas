use serde::{Serialize, Deserialize};
use crate::interfaces::iuser::IUser;
use serde_json;

/// Standard Auth Response (Web/Mobile)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    pub user: IUser,
    pub tokens: serde_json::Value,
}