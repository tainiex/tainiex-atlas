/**
 * WebSocket State Machine Types
 * 定义状态机的状态和事件类型常量
 */

/**
 * 状态机状态类型
 */
export const WebSocketStates = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  AUTHENTICATING: 'authenticating',
  READY: 'ready',
  ERROR: 'error',
} as const;

export type WebSocketState =
  (typeof WebSocketStates)[keyof typeof WebSocketStates];

/**
 * 状态机事件类型
 */
export const WebSocketEventTypes = {
  CONNECT: 'CONNECT',
  CONNECTION_ESTABLISHED: 'CONNECTION_ESTABLISHED',
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAILED: 'AUTH_FAILED',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
  DISCONNECT: 'DISCONNECT',
  RETRY: 'RETRY',
  FATAL_ERROR: 'FATAL_ERROR',
} as const;

export type WebSocketEventType =
  (typeof WebSocketEventTypes)[keyof typeof WebSocketEventTypes];

/**
 * 客户端事件类型（服务器发送给客户端的事件）
 */
export const ClientEventTypes = {
  ERROR: 'error',
  PACKET_PING: 'packet:ping',
  CHAT_ERROR: 'chat:error',
  CHAT_STREAM: 'chat:stream',
  YJS_SYNC: 'yjs:sync',
  YJS_UPDATE: 'yjs:update',
  PRESENCE_JOIN: 'presence:join',
  PRESENCE_LEAVE: 'presence:leave',
  PRESENCE_LIST: 'presence:list',
  CURSOR_UPDATE: 'cursor:update',
  COLLABORATION_ERROR: 'collaboration:error',
  COLLABORATION_LIMIT: 'collaboration:limit',
} as const;

export type ClientEventType =
  (typeof ClientEventTypes)[keyof typeof ClientEventTypes];
