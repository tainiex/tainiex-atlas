use serde::{Serialize, Deserialize};
use crate::interfaces::activity_status::ActivityStatus;
use serde_json;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEventPayload {
    pub session_id: String,
    pub activity_id: String,
    pub r#type: String,
    pub description: String,
    pub status: ActivityStatus,
    pub timestamp: f64,
    pub metadata: Option<serde_json::Value>,
}