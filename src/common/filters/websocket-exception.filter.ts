import { Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { WebSocketErrorCode, WsErrorResponse } from '@tainiex/shared-atlas';
import { Socket } from 'socket.io';

@Catch()
export class WebSocketExceptionFilter extends BaseWsExceptionFilter {
    private readonly logger = new Logger(WebSocketExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const client = host.switchToWs().getClient<Socket>();
        const data = host.switchToWs().getData();

        const error = this.handleError(exception, client);

        // Emit error to client
        client.emit('error', error);
    }

    private handleError(exception: unknown, client?: Socket): WsErrorResponse {
        let structuredError: WsErrorResponse;

        if (exception instanceof WsException) {
            const err = exception.getError();
            structuredError = {
                code: WebSocketErrorCode.INTERNAL_ERROR, // Default, ideally WsException should carry code
                message: typeof err === 'string' ? err : (err as any).message || 'WebSocket Error',
                category: 'SERVER', // Default
                timestamp: new Date().toISOString()
            };

            // Try to extract code if present
            if (typeof err === 'object' && (err as any).code) {
                structuredError.code = (err as any).code;
            }
        } else if (exception instanceof HttpException) {
            structuredError = {
                code: WebSocketErrorCode.INVALID_PAYLOAD, // Assuming HttpException is mostly validation
                message: exception.message,
                category: 'VALIDATION',
                details: exception.getResponse(),
                timestamp: new Date().toISOString()
            };
        } else {
            // General Error
            structuredError = this.categorizeError(exception);
        }

        // Context logging
        const userId = client?.data?.user?.id || 'anonymous';
        this.logger.error(
            `WebSocket Error [User: ${userId}]: ${structuredError.message}`,
            {
                code: structuredError.code,
                category: structuredError.category,
                stack: (exception as any).stack
            }
        );

        return structuredError;
    }

    private categorizeError(error: any): WsErrorResponse {
        // JWT Errors
        if (error.name === 'JsonWebTokenError') {
            return {
                code: WebSocketErrorCode.AUTH_TOKEN_INVALID,
                message: 'Invalid authentication token',
                category: 'AUTH',
                timestamp: new Date().toISOString()
            };
        }

        if (error.name === 'TokenExpiredError') {
            return {
                code: WebSocketErrorCode.AUTH_TOKEN_EXPIRED,
                message: 'Authentication token expired',
                category: 'AUTH',
                timestamp: new Date().toISOString()
            };
        }

        // Database Errors (PostgreSQL)
        if (error.code?.startsWith('23')) {
            return {
                code: WebSocketErrorCode.DATABASE_ERROR,
                message: 'Database operation failed',
                category: 'SERVER',
                details: { dbCode: error.code },
                timestamp: new Date().toISOString()
            };
        }

        // Default Server Error
        return {
            code: WebSocketErrorCode.INTERNAL_ERROR,
            message: 'An unexpected error occurred',
            category: 'SERVER',
            details: { original: error.message },
            timestamp: new Date().toISOString()
        };
    }
}
