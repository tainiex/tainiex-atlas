use serde::{Serialize, Deserialize};
use serde_json;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IVectorStoreRecord {
    pub id: String,
    pub content: String,
    pub embedding: Vec<f64>,
    pub metadata: serde_json::Value,
}