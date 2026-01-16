import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for fetching chat messages with pagination.
 * 获取聊天消息的分页 DTO。
 * 
 * API: `GET /api/chat/sessions/:id/messages`
 */
export class GetMessagesDto {
    /**
     * Number of messages to retrieve (Pagination limit).
     * Default: 20
     * max: 100
     * 获取的消息数量（分页限制）。
     */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;

    /**
     * Cursor for pagination. Fetch messages OLDER than this message ID.
     * 分页游标。获取早于此消息 ID 的消息。
     */
    @IsOptional()
    @IsString()
    before?: string;

    /**
     * Optional leaf message ID to fetch a specific conversation path.
     * If provided, returns the lineage from root to this leaf.
     * 可选的叶子消息 ID，用于获取特定的对话路径。
     * 如果提供，则返回从根到此叶子的谱系。
     */
    @IsOptional()
    @IsString()
    leafMessageId?: string;
}
