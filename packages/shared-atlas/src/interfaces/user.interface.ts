/**
 * Represents a User entity in the system for frontend consumption.
 * Contains public profile information. Sensitive data like passwords are excluded.
 */
export interface IUser {
    /** Unique UUID of the user. */
    id: string;
    /** Unique username chosen by the user. */
    username: string;
    /** Email address of the user. */
    email: string;
    /** 
     * URL to the user's avatar image.
     * Can be a GCS signed URL or external URL (e.g., Google profile picture). 
     */
    avatar?: string;
    /** Timestamp when the user account was registered. */
    createdAt: Date;
    /** Timestamp when the user profile was last updated. */
    updatedAt: Date;
}
