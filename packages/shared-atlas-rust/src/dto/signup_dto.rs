use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignupDto {
    pub username: String,
    pub password: String,
    pub invitation_code: String,
    pub email: Option<String>,
}