use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleLoginDto {
    pub code: Option<String>,
    pub id_token: Option<String>,
}