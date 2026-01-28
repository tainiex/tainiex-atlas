use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialSignupDto {
    pub invitation_code: String,
    pub signup_token: String,
}