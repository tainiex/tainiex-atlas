use serde::{Serialize, Deserialize};
use serde_json;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientToServerEvents {
    #[serde(rename = "note:join")]
    pub note_join: serde_json::Value,
    #[serde(rename = "note:leave")]
    pub note_leave: serde_json::Value,
    #[serde(rename = "yjs:update")]
    pub yjs_update: serde_json::Value,
    #[serde(rename = "cursor:update")]
    pub cursor_update: serde_json::Value,
}