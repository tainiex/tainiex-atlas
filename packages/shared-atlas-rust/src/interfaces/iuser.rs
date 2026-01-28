use serde::{Serialize, Deserialize};

/// Represents a User entity in the system for frontend consumption.
/// Contains public profile information. Sensitive data like passwords are excluded.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IUser {
/// Unique UUID of the user.
    pub id: String,
/// Unique username chosen by the user.
    pub username: String,
/// Email address of the user.
    pub email: String,
/// URL to the user's avatar image.
/// Can be a GCS signed URL or external URL (e.g., Google profile picture).
    pub avatar: Option<String>,
/// Timestamp when the user account was registered.
    pub created_at: chrono::DateTime<chrono::Utc>,
/// Timestamp when the user profile was last updated.
    pub updated_at: chrono::DateTime<chrono::Utc>,
}