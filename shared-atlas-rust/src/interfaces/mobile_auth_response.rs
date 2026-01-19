use serde::{Serialize, Deserialize};
use crate::interfaces::iuser::IUser;
use serde_json;

/// Prefix: Mobile
/// Used for mobile app authentication response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileAuthResponse {
    pub user: IUser,
    pub tokens: serde_json::Value,
}