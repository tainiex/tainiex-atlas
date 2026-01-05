/**
 * Enum defining the role of the message sender in a chat session.
 * 定义聊天会话中消息发送者的角色。
 * 
 * Usage / 使用场景:
 * - `IChatMessage.role`
 * - `ChatSendPayload.role`
 * - `AddMessageDto.role`
 */
export enum ChatRole {
    /** 
     * The human user interacting with the system. 
     * 用户：代表操作系统的真实人类用户。
     */
    USER = 'user',

    /** 
     * The AI assistant responding to the user. 
     * AI 助手：代表系统生成的回复。
     */
    ASSISTANT = 'assistant'
}

/**
 * Represents a chat session or conversation thread.
 * Only metadata is stored here; messages are retrieved separately.
 * 代表一个聊天会话或对话线程。此处仅存储元数据，消息内容需单独获取。
 * 
 * Related APIs / 相关接口:
 * - `GET /api/chat/sessions`: Returns a list of sessions (ChatSession[]).
 * - `GET /api/chat/sessions/:id`: Returns details of a specific session.
 * - `POST /api/chat/sessions`: Creates and returns a new session.
 */
export interface IChatSession {
    /** 
     * Unique UUID of the session. 
     * 会话的唯一 UUID。
     */
    id: string;

    /** 
     * UUID of the user who owns this session. 
     * 拥有此会话的用户的 UUID。
     */
    userId: string;

    /** 
     * Auto-generated title of the conversation. 
     * Usually summarized from the first message.
     * 会话标题，通常由第一条消息自动总结生成。
     */
    title: string;

    /** 
     * Timestamp when the session was created. 
     * 会话创建时间。
     */
    createdAt: Date;

    /** 
     * Timestamp when the last message was added or session updated. 
     * 会话最后更新时间（如有新消息）。
     */
    updatedAt: Date;
}

/**
 * Represents a single message within a chat session.
 * 代表聊天会话中的单条消息。
 * 
 * Related APIs / 相关接口:
 * - `GET /api/chat/sessions/:id/messages`: Returns a list of messages (ChatMessage[]).
 */
export interface IChatMessage {
    /** 
     * Unique UUID of the message. 
     * 消息的唯一 UUID。
     */
    id: string;

    /** 
     * UUID of the session this message belongs to. 
     * 此消息所属会话的 UUID。
     */
    sessionId: string;

    /** 
     * The role of the sender (User or Assistant). 
     * 发送者角色（用户或 AI）。
     */
    role: ChatRole;

    /** 
     * The actual text content of the message. 
     * 消息的文本内容。
     */
    content: string;

    /** 
     * Timestamp when the message was created. 
     * 消息创建时间。
     */
    createdAt: Date;
}

// ==========================================
// Request DTOs (Data Transfer Objects)
// 请求 DTO
// ==========================================

/**
 * Payload for creating a new chat session.
 * 创建新聊天会话的请求体。
 * 
 * API: `POST /api/chat/sessions`
 */
export interface CreateSessionDto {
    // Potentially empty for now, but good practice to have.
    // 目前为空，但保留以备扩展。
}

/**
 * Payload for adding a new message to a session via REST API.
 * 通过 REST API 向会话添加新消息的请求体。
 * 
 * API: `POST /api/chat/sessions/:id/messages`
 * Note: This endpoint now supports Streaming responses (Server-Sent Events / Chunked Transfer).
 * 注意：此接口现在支持流式响应。
 */
export interface AddMessageDto {
    /** 
     * The text content of the message to send. 
     * 发送的消息内容。
     */
    content: string;

    /** 
     * Optional role of the sender. 
     * Defaults to 'user' if not specified.
     * 发送者角色，默认为 'user'。
     */
    role?: ChatRole;

    /**
     * Optional model to use for generating response.
     * If not provided, defaults to the system default model.
     * 指定用于生成的模型 ID。如不填则使用系统默认模型。
     */
    model?: string;
}

// ==========================================
// Response DTOs
// 响应 DTO
// ==========================================

/**
 * API response structure for a chat session.
 * Match of IChatSession for now.
 * 聊天会话的 API 响应结构，目前与 IChatSession 一致。
 */
export interface ChatSessionResponse extends IChatSession { }

/**
 * API response structure for a chat message.
 * Match of IChatMessage for now.
 * 聊天消息的 API 响应结构，目前与 IChatMessage 一致。
 */
export interface ChatMessageResponse extends IChatMessage { }

// ==========================================
// WebSocket Event DTOs
// WebSocket 事件 DTO
// ==========================================

/**
 * Payload for sending a message via WebSocket.
 * 通过 WebSocket 发送消息的 Payload。
 * 
 * Event: `client.emit('chat:send', payload)`
 */
export interface ChatSendPayload {
    /** 
     * Session ID to send the message to. 
     * 目标会话 ID。
     */
    sessionId: string;

    /** 
     * Message content. 
     * 消息内容。
     */
    content: string;

    /** 
     * Optional role (defaults to USER). 
     * 角色（可选，默认 USER）。
     */
    role?: ChatRole;

    /** 
     * Optional model to use for response generation. 
     * 指定模型（可选）。
     */
    model?: string;
}

/**
 * Stream event from server to client.
 * 服务端发送给客户端的流式事件。
 * 
 * Event: `socket.on('chat:stream', (event: ChatStreamEvent) => { ... })`
 */
export interface ChatStreamEvent {
    /** 
     * Event type: 
     * - `chunk`: A piece of the generated text. (生成的一段文本)
     * - `done`: Generation completed. (生成完成)
     * - `error`: An error occurred. (发生错误)
     */
    type: 'chunk' | 'done' | 'error';

    /** 
     * Text data for `chunk` events. 
     * 当 type='chunk' 时，包含文本片段。
     */
    data?: string;

    /** 
     * Error message for `error` events. 
     * 当 type='error' 时，包含错误信息。
     */
    error?: string;
}

/**
 * Payload for chat:error event.
 * 一般性 WebSocket 错误事件 Payload。
 * 
 * Event: `socket.on('chat:error', (payload: ChatErrorPayload) => { ... })`
 */
export interface ChatErrorPayload {
    /**
     * The error message / 错误信息。
     */
    error: string;
}
