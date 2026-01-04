/**
 * Enum defining the role of the message sender in a chat session.
 */
export enum ChatRole {
    /** The human user interacting with the system. */
    USER = 'user',
    /** The AI assistant responding to the user. */
    ASSISTANT = 'assistant'
}

/**
 * Represents a chat session or conversation thread.
 * Only metadata is stored here; messages are retrieved separately.
 */
export interface IChatSession {
    /** Unique UUID of the session. */
    id: string;
    /** UUID of the user who owns this session. */
    userId: string;
    /** 
     * Auto-generated title of the conversation. 
     * Usually summarized from the first message.
     */
    title: string;
    /** Timestamp when the session was created. */
    createdAt: Date;
    /** Timestamp when the last message was added or session updated. */
    updatedAt: Date;
}

/**
 * Represents a single message within a chat session.
 */
export interface IChatMessage {
    /** Unique UUID of the message. */
    id: string;
    /** UUID of the session this message belongs to. */
    sessionId: string;
    /** The role of the sender (User or Assistant). */
    role: ChatRole;
    /** The actual text content of the message. */
    content: string;
    /** Timestamp when the message was created. */
    createdAt: Date;
}

// Request DTOs

/**
 * Payload for creating a new chat session.
 * Currently empty as sessions are initialized without parameters.
 */
export interface CreateSessionDto {
    // Potentially empty for now, but good practice to have
}

/**
 * Payload for adding a new message to a session.
 */
export interface AddMessageDto {
    /** The text content of the message to send. */
    content: string;
    /** 
     * Optional role of the sender. 
     * Defaults to 'user' if not specified. 
     */
    role?: ChatRole;
    /**
     * Optional model to use for generating response.
     * If not provided, defaults to the system default model.
     */
    model?: string;
}

// Response DTOs

/**
 * API response structure for a chat session.
 * Match of IChatSession for now.
 */
export interface ChatSessionResponse extends IChatSession { }

/**
 * API response structure for a chat message.
 * Match of IChatMessage for now.
 */
export interface ChatMessageResponse extends IChatMessage { }
