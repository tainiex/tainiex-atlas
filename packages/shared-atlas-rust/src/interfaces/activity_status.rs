use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActivityStatus {
    #[serde(rename = "STARTED")]
    Started,
    #[serde(rename = "IN_PROGRESS")]
    InProgress,
    #[serde(rename = "COMPLETED")]
    Completed,
    #[serde(rename = "FAILED")]
    Failed,
}