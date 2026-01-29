/**
 * State machine with dynamic context types
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createMachine, assign, ActorRefFrom } from 'xstate';
import { Socket } from 'socket.io';

import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { LoggerService } from '../logger/logger.service';

/**
 * Socket 扩展接口，包含用户数据
 */
export interface AuthenticatedSocket extends Socket {
    data: {
        user?: JwtPayload;
    };
}

/**
 * 状态机上下文（状态数据）
 */
export interface WebSocketMachineContext {
    client: AuthenticatedSocket;
    user: JwtPayload | null;
    token: string | null;
    retryCount: number;
    tokenExpiresAt: number | null;
    ip: string;
    error: string | null;
}

/**
 * 状态机事件
 */
export type WebSocketMachineEvent =
    | { type: 'CONNECT'; client: AuthenticatedSocket; token: string; ip: string }
    | { type: 'CONNECTION_ESTABLISHED' }
    | { type: 'AUTH_SUCCESS'; user: JwtPayload; expiresAt: number }
    | { type: 'AUTH_FAILED'; error: string }
    | { type: 'TOKEN_REFRESHED'; newToken: string }
    | { type: 'DISCONNECT'; reason?: string }
    | { type: 'RETRY' }
    | { type: 'FATAL_ERROR'; error: string };

/**
 * WebSocket 状态机服务
 * 管理 WebSocket 连接的生命周期状态
 */
@Injectable()
export class WebSocketStateMachineService {
    private readonly MAX_RETRIES = 3;
    private readonly TOKEN_EXPIRY_WARNING_MS = 5 * 60 * 1000; // 5 分钟

    constructor(
        private readonly jwtService: JwtService,
        private readonly logger: LoggerService
    ) {
        this.logger.setContext(WebSocketStateMachineService.name);
    }

    /**
     * 创建 WebSocket 状态机
     */
    createMachine(clientId: string) {
        return createMachine(
            {
                /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOgEkBRAGQH0BZAMVLoHEBlEgDQdoG0AGALoA7WJVQIAdmlyp+tKSAAeiAEwBWAHQAaEAE9EAJgAcxgCyGAbIYAsATh16zAZgN6AjAF8PhqNlx4BCTkVLT0TCycPHwCwmISCEoq2gCcZqamBlaGBvpmpmZGurq2Dgjp5hZBvhbaZmYBBoa+5mYW-oEYOPhEpJTUtAyR0bHxSSmCGQLZeYUl5ZVigsa66tbpBua6Og4NOlruCCoKZmYdeg0BiM2GeuZ+5nrGZrr9uqZBY+MYGISzRPNLMtbDY-PZHA5nK43B5PFF1p5RFk4kp9noQQ0DE81D5EIZ6vpoVUal0-hoAQ1zH9cRA8BRyHgmCwwBgKlJqqUtPkjHkACyGAyGDraEwGfQ9QwIlE-WYAGlCTGx+KJhOMWAA7mR8NgAG5YfBgIj4Yi08iFEraBQuXT1ZEIsxGQw+PS48ym8zfIXYnFrPEEolkjiU6nUhh0hlMiE0gCyDIAbgA3OrBQWmbGaREWQwOeF2ZGtbpEDr1Jw9b0gA */
                id: `websocket-${clientId}`,
                initial: 'disconnected',
                types: {} as {
                    context: WebSocketMachineContext;
                    events: WebSocketMachineEvent;
                },
                context: {
                    client: null as any, // 初始化时为 null，CONNECT 事件时赋值
                    user: null,
                    token: null,
                    retryCount: 0,
                    tokenExpiresAt: null,
                    ip: '',
                    error: null,
                },

                states: {
                    /**
                     * 断开连接状态
                     */
                    disconnected: {
                        entry: 'cleanup',
                        on: {
                            CONNECT: {
                                target: 'connecting',
                                actions: 'assignConnectionData',
                            },
                        },
                    },

                    /**
                     * 正在连接状态
                     */
                    connecting: {
                        always: {
                            target: 'connected',
                        },
                    },

                    /**
                     * 已连接，准备认证
                     */
                    connected: {
                        entry: 'logConnected',
                        always: {
                            target: 'authenticating',
                        },
                    },

                    /**
                     * 正在认证状态
                     */
                    authenticating: {
                        entry: 'authenticateClient',
                        on: {
                            AUTH_SUCCESS: {
                                target: 'ready',
                                actions: 'assignUser',
                            },
                            AUTH_FAILED: {
                                target: 'error',
                                actions: 'assignError',
                            },
                        },
                    },

                    /**
                     * 就绪状态（已认证）
                     */
                    ready: {
                        entry: 'logReady',
                        on: {
                            TOKEN_REFRESHED: {
                                target: 'authenticating',
                                actions: 'assignNewToken',
                            },
                            DISCONNECT: {
                                target: 'disconnected',
                            },
                            FATAL_ERROR: {
                                target: 'error',
                                actions: 'assignError',
                            },
                        },
                    },

                    /**
                     * 错误状态
                     */
                    error: {
                        entry: ['logError', 'emitError'],
                        always: [
                            {
                                target: 'connecting',
                                guard: 'canRetry',
                                actions: ['incrementRetry', 'scheduleRetry'],
                            },
                            {
                                target: 'disconnected',
                            },
                        ],
                    },
                },
            },
            {
                actions: {
                    /**
                     * 分配连接数据
                     */
                    assignConnectionData: assign({
                        client: ({ event }) =>
                            (event as Extract<WebSocketMachineEvent, { type: 'CONNECT' }>).client,
                        token: ({ event }) =>
                            (event as Extract<WebSocketMachineEvent, { type: 'CONNECT' }>).token,
                        ip: ({ event }) =>
                            (event as Extract<WebSocketMachineEvent, { type: 'CONNECT' }>).ip,
                    }),

                    /**
                     * 分配用户信息
                     */
                    assignUser: assign({
                        user: ({ event }) =>
                            (event as Extract<WebSocketMachineEvent, { type: 'AUTH_SUCCESS' }>)
                                .user,
                        tokenExpiresAt: ({ event }) =>
                            (event as Extract<WebSocketMachineEvent, { type: 'AUTH_SUCCESS' }>)
                                .expiresAt,
                        error: null,
                    }),

                    /**
                     * 分配新令牌
                     */
                    assignNewToken: assign({
                        token: ({ event }) =>
                            (event as Extract<WebSocketMachineEvent, { type: 'TOKEN_REFRESHED' }>)
                                .newToken,
                        retryCount: 0, // 重置重试计数
                    }),

                    /**
                     * 分配错误信息
                     */
                    assignError: assign({
                        error: ({ event }) => {
                            const errorEvent = event as
                                | Extract<WebSocketMachineEvent, { type: 'AUTH_FAILED' }>
                                | Extract<WebSocketMachineEvent, { type: 'FATAL_ERROR' }>;
                            return errorEvent.error;
                        },
                    }),

                    /**
                     * 增加重试计数
                     */
                    incrementRetry: assign({
                        retryCount: ({ context }) => context.retryCount + 1,
                    }),

                    /**
                     * 记录日志：已连接
                     */
                    logConnected: ({ context }) => {
                        this.logger.log(`Socket connected: ${context.client.id}`);
                    },

                    /**
                     * 记录日志：认证成功
                     */
                    logReady: ({ context }) => {
                        this.logger.log(
                            `User authenticated: ${context.user?.sub} (socket: ${context.client.id})`
                        );
                    },

                    /**
                     * 记录日志：错误
                     */
                    logError: ({ context }) => {
                        this.logger.error(
                            `WebSocket error (socket: ${context.client.id}): ${context.error}`
                        );
                    },

                    /**
                     * 发送错误事件到客户端
                     */
                    emitError: ({ context }) => {
                        if (context.client && context.client.connected) {
                            context.client.emit('error', {
                                code: 'AUTH_ERROR',
                                message: context.error || 'Authentication failed',
                                category: 'AUTH',
                            });
                        }
                    },

                    /**
                     * 执行客户端认证
                     * 注意：这是一个同步 action，实际的异步认证逻辑在外部处理
                     */
                    authenticateClient: ({ context }) => {
                        // 异步认证逻辑将在外部调用，这里只是标记进入认证状态
                        // 外部代码会调用 jwtService.verifyAsync，然后发送 AUTH_SUCCESS 或 AUTH_FAILED 事件
                        this.logger.debug(
                            `Starting authentication for socket: ${context.client.id}`
                        );
                    },

                    /**
                     * 调度重试
                     */
                    scheduleRetry: ({ context, self }) => {
                        const delay = Math.min(1000 * Math.pow(2, context.retryCount), 30000);
                        this.logger.log(
                            `Scheduling retry ${context.retryCount + 1}/${this.MAX_RETRIES} in ${delay}ms`
                        );

                        setTimeout(() => {
                            self.send({ type: 'RETRY' });
                        }, delay);
                    },

                    /**
                     * 清理资源
                     */
                    cleanup: ({ context }) => {
                        if (context.client && context.client.connected) {
                            this.logger.log(`Cleaning up socket: ${context.client.id}`);
                            // 实际的清理逻辑（如 tokenLifecycleService.clearTimer）
                            // 应在外部 handleDisconnect 中调用
                        }
                    },
                },

                guards: {
                    /**
                     * 检查是否可以重试
                     */
                    canRetry: ({ context }) => {
                        return context.retryCount < this.MAX_RETRIES;
                    },
                },
            }
        );
    }

    /**
     * 从状态机中提取令牌（辅助方法）
     */
    extractToken(client: AuthenticatedSocket): string | undefined {
        // 1. 尝试 handshake auth
        let token: string | undefined = client.handshake.auth?.token as string | undefined;

        // 2. 尝试 Authorization header
        if (!token) {
            token = client.handshake.headers['authorization'];
        }

        // 3. 回退到 Cookies
        if (!token && client.handshake.headers.cookie) {
            const cookies = client.handshake.headers.cookie.split(';').reduce(
                (acc, curr) => {
                    const [name, value] = curr.trim().split('=');
                    acc[name] = value;
                    return acc;
                },
                {} as Record<string, string>
            );

            token = cookies['access_token'];
        }

        // 移除 "Bearer " 前缀
        if (token && typeof token === 'string') {
            if (token.toLowerCase().startsWith('bearer ')) {
                token = token.slice(7).trim();
            }
        }

        return token || undefined;
    }
}

/**
 * 状态机 Actor 类型（用于类型推断）
 */
export type WebSocketMachineActor = ActorRefFrom<
    ReturnType<WebSocketStateMachineService['createMachine']>
>;
