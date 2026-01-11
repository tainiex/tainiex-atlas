/**
 * Enum defining the type of a content block in a note.
 * 定义笔记中内容块的类型。
 * 
 * Usage / 使用场景:
 * - `IBlock.type`
 * - `CreateBlockDto.type`
 */
export enum BlockType {
    /** Plain text paragraph / 普通文本段落 */
    TEXT = 'TEXT',

    /** Heading level 1 / 一级标题 */
    HEADING1 = 'HEADING1',

    /** Heading level 2 / 二级标题 */
    HEADING2 = 'HEADING2',

    /** Heading level 3 / 三级标题 */
    HEADING3 = 'HEADING3',

    /** Bullet point list / 无序列表 */
    BULLET_LIST = 'BULLET_LIST',

    /** Numbered list / 有序列表 */
    NUMBERED_LIST = 'NUMBERED_LIST',

    /** Todo/checkbox list / 待办事项列表 */
    TODO_LIST = 'TODO_LIST',

    /** Todo item / 待办事项 */
    TODO_ITEM = 'TODO_ITEM',

    /** Table with rows and columns / 表格 */
    TABLE = 'TABLE',

    /** Code block with syntax highlighting / 代码块 */
    CODE = 'CODE',

    /** Image (stored in GCS) / 图片（存储在GCS） */
    IMAGE = 'IMAGE',

    /** Video (stored in GCS) / 视频（存储在GCS） */
    VIDEO = 'VIDEO',

    /** File attachment (stored in GCS) / 文件附件（存储在GCS） */
    FILE = 'FILE',

    /** Horizontal divider / 分割线 */
    DIVIDER = 'DIVIDER',

    /** Quote block / 引用块 */
    QUOTE = 'QUOTE',

    /** Callout/alert box / 提示框 */
    CALLOUT = 'CALLOUT',

    /** Toggle list / 折叠列表 */
    TOGGLE = 'TOGGLE',
}

/**
 * Represents a note/page in the system.
 * 代表系统中的一个笔记/页面。
 * 
 * Related APIs / 相关接口:
 * - `GET /api/notes`: Returns a list of notes (INote[]).
 * - `GET /api/notes/:id`: Returns details of a specific note.
 * - `POST /api/notes`: Creates and returns a new note.
 */
export interface INote {
    /** 
     * Unique UUID of the note. 
     * 笔记的唯一 UUID。
     */
    id: string;

    /** 
     * UUID of the user who owns this note. 
     * 拥有此笔记的用户的 UUID。
     */
    userId: string;

    /** 
     * Title of the note (max 200 characters). 
     * 笔记标题（最多200字符）。
     */
    title: string;

    /** 
     * Optional cover image URL (GCS signed URL). 
     * 可选的封面图片URL（GCS签名URL）。
     */
    coverImage?: string;

    /** 
     * Optional icon emoji or URL. 
     * 可选的图标emoji或URL。
     */
    icon?: string;

    /** 
     * Optional parent note ID for hierarchical structure. 
     * 可选的父笔记ID，用于构建层级结构。
     */
    parentId?: string;

    /**
     * Whether the note has children (computed property).
     * 笔记是否有子节点（计算属性）。
     */
    hasChildren?: boolean;

    /** 
     * Optional template type used to create this note. 
     * 可选的模板类型，用于创建此笔记。
     */
    template?: string;

    /** 
     * Whether the note is publicly accessible. 
     * 笔记是否公开可访问。
     */
    isPublic: boolean;

    /** 
     * Soft delete flag. 
     * 软删除标记。
     */
    isDeleted: boolean;

    /** 
     * Timestamp when the note was created. 
     * 笔记创建时间。
     */
    createdAt: Date | string;

    /** 
     * Timestamp when the note was last updated. 
     * 笔记最后更新时间。
     */
    updatedAt: Date | string;

    /** 
     * UUID of the user who last edited this note. 
     * 最后编辑此笔记的用户UUID。
     */
    lastEditedBy: string;
}

/**
 * Represents a content block within a note.
 * 代表笔记中的一个内容块。
 * 
 * Related APIs / 相关接口:
 * - `GET /api/notes/:noteId/blocks`: Returns all blocks of a note.
 * - `POST /api/notes/:noteId/blocks`: Creates a new block.
 * - `PATCH /api/blocks/:id`: Updates a block.
 */
export interface IBlock {
    /** 
     * Unique UUID of the block. 
     * 块的唯一 UUID。
     */
    id: string;

    /** 
     * UUID of the note this block belongs to. 
     * 此块所属笔记的 UUID。
     */
    noteId: string;

    /** 
     * Type of the block (text, heading, image, etc.). 
     * 块的类型（文本、标题、图片等）。
     */
    type: BlockType;

    /** 
     * Plain text content or serialized content. 
     * For images/videos/files, this is the GCS URL.
     * 纯文本内容或序列化内容。
     * 对于图片/视频/文件，这是GCS URL。
     */
    content: string;

    /** 
     * Type-specific metadata (JSON object). 
     * Examples: table structure, code language, file info.
     * 块类型特定的元数据（JSON对象）。
     * 示例：表格结构、代码语言、文件信息。
     */
    metadata: any;

    /** 
     * Optional parent block ID for nested structures. 
     * 可选的父块ID，用于嵌套结构。
     */
    parentBlockId?: string;

    /** 
     * Position/order within parent (0-indexed). 
     * 在父级中的位置/顺序（从0开始）。
     */
    position: number;

    /** 
     * Timestamp when the block was created. 
     * 块创建时间。
     */
    createdAt: Date;

    /** 
     * Timestamp when the block was last updated. 
     * 块最后更新时间。
     */
    updatedAt: Date;

    /** 
     * UUID of the user who created this block. 
     * 创建此块的用户UUID。
     */
    createdBy: string;

    /** 
     * UUID of the user who last edited this block. 
     * 最后编辑此块的用户UUID。
     */
    lastEditedBy: string;

    /** 
     * Optional nested children blocks (for tree structure rendering). 
     * 可选的嵌套子块（用于树状结构渲染）。
     */
    children?: IBlock[];

    /**
     * Optional soft delete flag.
     * 可选的软删除标记。
     */
    isDeleted?: boolean;
}

/**
 * Represents a collaborator in a note editing session.
 * 代表笔记编辑会话中的协作者。
 * 
 * Used for real-time presence indication.
 * 用于实时在线状态指示。
 */
export interface ICollaborator {
    /** 
     * UUID of the collaborating user. 
     * 协作用户的 UUID。
     */
    userId: string;

    /** 
     * Username for display. 
     * 用于显示的用户名。
     */
    username: string;

    /** 
     * Optional avatar URL. 
     * 可选的头像URL。
     */
    avatar?: string;

    /** 
     * Assigned color for cursor/selection highlight. 
     * 分配的光标/选区高亮颜色。
     */
    color: string;

    /** 
     * Current cursor position. 
     * 当前光标位置。
     */
    cursorPosition?: {
        blockId: string;
        offset: number;
    };

    /** 
     * Current text selection range. 
     * 当前文本选区范围。
     */
    selection?: {
        startBlockId: string;
        startOffset: number;
        endBlockId: string;
        endOffset: number;
    };
}

/**
 * Represents a note template.
 * 代表笔记模板。
 * 
 * Related APIs / 相关接口:
 * - `GET /api/templates`: Returns available templates.
 * - `POST /api/notes/from-template/:templateId`: Creates note from template.
 */
export interface INoteTemplate {
    /** 
     * Unique UUID of the template. 
     * 模板的唯一 UUID。
     */
    id: string;

    /** 
     * Template name. 
     * 模板名称。
     */
    name: string;

    /** 
     * Optional description. 
     * 可选的描述。
     */
    description?: string;

    /** 
     * Optional thumbnail URL. 
     * 可选的缩略图URL。
     */
    thumbnail?: string;

    /** 
     * Category (e.g., 'meeting', 'project', 'doc'). 
     * 分类（如：'meeting'、'project'、'doc'）。
     */
    category: string;

    /** 
     * Whether this is a public/system template. 
     * 是否为公共/系统模板。
     */
    isPublic: boolean;

    /** 
     * Optional creator user ID (null for system templates). 
     * 可选的创建者用户ID（系统模板为null）。
     */
    createdBy?: string;

    /** 
     * Template structure (array of block definitions). 
     * 模板结构（块定义数组）。
     */
    templateData: any;

    /** 
     * Number of times this template has been used. 
     * 此模板被使用的次数。
     */
    usageCount: number;

    /** 
     * Timestamp when the template was created. 
     * 模板创建时间。
     */
    createdAt: Date;

    /** 
     * Timestamp when the template was last updated. 
     * 模板最后更新时间。
     */
    updatedAt: Date;
}

// ==========================================
// Request DTOs (Data Transfer Objects)
// 请求 DTO
// ==========================================

/**
 * Payload for creating a new note.
 * 创建新笔记的请求体。
 * 
 * API: `POST /api/notes`
 */
export interface CreateNoteDto {
    /** 
     * Title of the note. 
     * 笔记标题。
     */
    title: string;

    /** 
     * Optional template ID to create from. 
     * 可选的模板ID。
     */
    templateId?: string;

    /** 
     * Optional parent note ID. 
     * 可选的父笔记ID。
     */
    parentId?: string;
}

/**
 * Payload for updating note metadata.
 * 更新笔记元数据的请求体。
 * 
 * API: `PATCH /api/notes/:id`
 */
export interface UpdateNoteDto {
    /** 
     * Optional new title. 
     * 可选的新标题。
     */
    title?: string;

    /** 
     * Optional new cover image URL. 
     * 可选的新封面图片URL。
     */
    coverImage?: string;

    /** 
     * Optional new icon. 
     * 可选的新图标。
     */
    icon?: string;
}

/**
 * Payload for creating a new block.
 * 创建新块的请求体。
 * 
 * API: `POST /api/notes/:noteId/blocks`
 */
export interface CreateBlockDto {
    /** 
     * Type of the block. 
     * 块的类型。
     */
    type: BlockType;

    /** 
     * Content of the block. 
     * 块的内容。
     */
    content: string;

    /** 
     * Optional metadata. 
     * 可选的元数据。
     */
    metadata?: any;

    /** 
     * Optional parent block ID. 
     * 可选的父块ID。
     */
    parentBlockId?: string;

    /** 
     * Optional position (defaults to end). 
     * 可选的位置（默认为末尾）。
     */
    position?: number;
}

/**
 * Payload for updating a block.
 * 更新块的请求体。
 * 
 * API: `PATCH /api/blocks/:id`
 */
export interface UpdateBlockDto {
    /** 
     * Optional new content. 
     * 可选的新内容。
     */
    content?: string;

    /** 
     * Optional new metadata. 
     * 可选的新元数据。
     */
    metadata?: any;
}

/**
 * Payload for moving a block.
 * 移动块的请求体。
 * 
 * API: `POST /api/blocks/:id/move`
 */
export interface MoveBlockDto {
    /** 
     * New position index. 
     * 新的位置索引。
     */
    position: number;

    /** 
     * Optional new parent block ID. 
     * 可选的新父块ID。
     */
    parentBlockId?: string;
}

// ==========================================
// Response DTOs
// 响应 DTO
// ==========================================

/**
 * API response structure for a note with blocks.
 * 包含块的笔记的 API 响应结构。
 */
export interface NoteWithBlocksResponse extends INote {
    /** 
     * All blocks in this note (tree structure). 
     * 此笔记中的所有块（树状结构）。
     */
    blocks: IBlock[];
}

/**
 * API response for search results.
 * 搜索结果的 API 响应。
 */
export interface SearchResultDto {
    /** 
     * Matching notes. 
     * 匹配的笔记。
     */
    notes: INote[];

    /** 
     * Matching blocks with highlight info. 
     * 匹配的块及高亮信息。
     */
    blocks: Array<IBlock & {
        /** Note this block belongs to / 此块所属的笔记 */
        note: Pick<INote, 'id' | 'title'>;
        /** Highlighted snippet / 高亮片段 */
        highlight?: string;
    }>;

    /** 
     * Total count of results. 
     * 结果总数。
     */
    total: number;
}

// ==========================================
// WebSocket Event DTOs (Collaboration)
// WebSocket 事件 DTO（协同编辑）
// ==========================================

/**
 * Payload for joining a note editing session.
 * 加入笔记编辑会话的 Payload。
 * 
 * Event: `client.emit('note:join', payload)`
 */
export interface NoteJoinPayload {
    /** 
     * Note ID to join. 
     * 要加入的笔记ID。
     */
    noteId: string;
}

/**
 * Payload for leaving a note editing session.
 * 离开笔记编辑会话的 Payload。
 * 
 * Event: `client.emit('note:leave', payload)`
 */
export interface NoteLeavePayload {
    /** 
     * Note ID to leave. 
     * 要离开的笔记ID。
     */
    noteId: string;
}

/**
 * Payload for Y.js update synchronization.
 * Y.js 更新同步的 Payload。
 * 
 * Event: `client.emit('yjs:update', payload)`
 * Event: `server.emit('yjs:update', payload)`
 */
export interface YjsUpdatePayload {
    /** 
     * Note ID. 
     * 笔记ID。
     */
    noteId: string;

    /** 
     * Y.js update data (Uint8Array encoded as base64 for JSON transport). 
     * Y.js 更新数据（Uint8Array编码为base64用于JSON传输）。
     */
    update: string;  // base64 encoded
}

/**
 * Payload for cursor position update.
 * 光标位置更新的 Payload。
 * 
 * Event: `client.emit('cursor:update', payload)`
 * Event: `server.emit('cursor:update', payload)`
 */
export interface CursorUpdatePayload {
    /** 
     * Note ID. 
     * 笔记ID。
     */
    noteId: string;

    /** 
     * Current cursor position. 
     * 当前光标位置。
     */
    position?: {
        blockId: string;
        offset: number;
    };

    /** 
     * Current selection range. 
     * 当前选区范围。
     */
    selection?: {
        startBlockId: string;
        startOffset: number;
        endBlockId: string;
        endOffset: number;
    };
}

/**
 * Event when a user joins the collaboration session.
 * 用户加入协作会话时的事件。
 * 
 * Event: `server.emit('presence:join', payload)`
 */
export interface PresenceJoinPayload {
    /** User ID / 用户ID */
    userId: string;

    /** Username / 用户名 */
    username: string;

    /** User avatar URL / 用户头像URL */
    avatar?: string;

    /** Assigned color / 分配的颜色 */
    color: string;
}

/**
 * Event when a user leaves the collaboration session.
 * 用户离开协作会话时的事件。
 * 
 * Event: `server.emit('presence:leave', payload)`
 */
export interface PresenceLeavePayload {
    /** User ID / 用户ID */
    userId: string;
}

/**
 * Event when max concurrent editors limit is reached.
 * 达到最大并发编辑人数限制时的事件。
 * 
 * Event: `server.emit('collaboration:limit', payload)`
 */
export interface CollaborationLimitPayload {
    /** Error message / 错误消息 */
    error: string;

    /** Current editor count / 当前编辑者数量 */
    currentEditors: number;

    /** Maximum allowed editors / 最大允许编辑者数量 */
    maxEditors: number;
}

/**
 * Payload for Y.js initial sync.
 * Y.js 初始同步的 Payload。
 * 
 * Event: `server.emit('yjs:sync', payload)`
 */
export interface YjsSyncPayload {
    /** Note ID / 笔记ID */
    noteId: string;

    /** Y.js update data (base64) / Y.js 更新数据 */
    update: string;

    /** State vector (base64) / 状态向量 */
    stateVector: string;
}

// ==========================================
// Socket.io Event Maps (Type Safety)
// Socket.io 事件映射（类型安全）
// ==========================================

export interface ClientToServerEvents {
    'note:join': (payload: NoteJoinPayload) => void;
    'note:leave': (payload: NoteLeavePayload) => void;
    'yjs:update': (payload: YjsUpdatePayload) => void;
    'cursor:update': (payload: CursorUpdatePayload) => void;
}

export interface ServerToClientEvents {
    'yjs:sync': (payload: YjsSyncPayload) => void;
    'yjs:update': (payload: YjsUpdatePayload) => void;
    'cursor:update': (payload: CursorUpdatePayload) => void;
    'presence:join': (payload: PresenceJoinPayload) => void;
    'presence:leave': (payload: PresenceLeavePayload) => void;
    'presence:list': (payload: ICollaborator[]) => void;
    'collaboration:limit': (payload: CollaborationLimitPayload) => void;
}
