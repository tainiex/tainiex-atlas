use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActivityStatus {
    STARTED,
    IN_PROGRESS,
    COMPLETED,
    FAILED,
}