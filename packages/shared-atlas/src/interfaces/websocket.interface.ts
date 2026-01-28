export enum WebSocketErrorCode {
    // Auth Errors (401x)
    AUTH_TOKEN_MISSING = 4010,
    AUTH_TOKEN_INVALID = 4011,
    AUTH_TOKEN_EXPIRED = 4012,

    // Permission Errors (403x)
    PERMISSION_DENIED = 4030,
    RATE_LIMIT_EXCEEDED = 4031,
    CONCURRENT_LIMIT_REACHED = 4032,

    // Validation/Business Errors (422x)
    INVALID_PAYLOAD = 4220,
    NOTE_NOT_FOUND = 4221,
    SESSION_NOT_FOUND = 4222,

    // Server Errors (500x)
    INTERNAL_ERROR = 5000,
    DATABASE_ERROR = 5001,
    YJS_SYNC_FAILED = 5002,
}

export interface WsErrorResponse {
    code: WebSocketErrorCode;
    message: string;
    category: 'AUTH' | 'PERMISSION' | 'VALIDATION' | 'SERVER';
    details?: any;
    timestamp: string;
}

export interface WsTokenExpiringPayload {
    expiresIn: number;
}

export interface WsTokenRefreshedPayload {
    newToken: string;
}

export interface WsMessageAckPayload {
    messageId: string;
}
