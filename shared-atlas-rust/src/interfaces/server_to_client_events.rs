use serde::{Serialize, Deserialize};
use serde_json;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerToClientEvents {
    #[serde(rename = "yjs:sync")]
    pub yjs_sync: serde_json::Value,
    #[serde(rename = "yjs:update")]
    pub yjs_update: serde_json::Value,
    #[serde(rename = "cursor:update")]
    pub cursor_update: serde_json::Value,
    #[serde(rename = "presence:join")]
    pub presence_join: serde_json::Value,
    #[serde(rename = "presence:leave")]
    pub presence_leave: serde_json::Value,
    #[serde(rename = "presence:list")]
    pub presence_list: serde_json::Value,
    #[serde(rename = "collaboration:limit")]
    pub collaboration_limit: serde_json::Value,
}