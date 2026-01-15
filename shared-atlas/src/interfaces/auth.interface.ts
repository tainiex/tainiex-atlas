import { IUser } from './user.interface';

/**
 * Prefix: Mobile
 * Used for mobile app authentication response.
 */
export interface MobileAuthResponse {
    user: IUser;
    tokens: {
        access_token: string;
        refresh_token: string;
    };
}

/**
 * Standard Auth Response (Web/Mobile)
 * @deprecated Use MobileAuthResponse for mobile specific typing if needed, or this for general.
 */
export interface AuthResponse {
    user: IUser;
    tokens: {
        access_token: string;
        refresh_token: string;
    };
}

/**
 * Token Response - Used for refresh token endpoint
 * Contains access and refresh tokens
 */
export interface TokenResponse {
    access_token: string;
    refresh_token: string;
}

/**
 * Refresh Token Response for Mobile
 * Mobile clients expect tokens wrapped in a tokens object
 */
export interface RefreshTokenResponse {
    tokens: TokenResponse;
}

/**
 * Refresh Token Response for Web
 * Web clients receive a simple message confirmation
 */
export interface RefreshMessageResponse {
    message: string;
}
