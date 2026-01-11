
import { IsString, IsUUID, IsOptional, IsEnum, Length } from 'class-validator';
import { ChatRole, ChatSendPayload } from '@tainiex/shared-atlas';

/**
 * DTO for validating WebSocket chat messages.
 * 用于验证 WebSocket 聊天消息的传输对象。
 * 
 * Enforced by `ValidationPipe` in `ChatGateway`.
 */
export class ChatSendDto implements ChatSendPayload {
    /**
     * Target Session UUID.
     * 目标会话 ID (必须是 UUID v4).
     */
    @IsUUID(4, { message: 'Invalid Session ID format' })
    sessionId: string;

    /**
     * Message content.
     * 消息内容 (1-4000字符).
     */
    @IsString()
    @Length(1, 4000, { message: 'Message content must be between 1 and 4000 characters' })
    content: string;

    /**
     * Sender role (user/assistant).
     * 发送者角色 (可选，默认为 user).
     */
    @IsOptional()
    @IsEnum(ChatRole)
    role?: ChatRole;

    /**
     * Model identifier.
     * 模型 ID (可选).
     */
    @IsOptional()
    @IsString()
    model?: string;

    @IsOptional()
    @IsString()
    parentId?: string;
}
