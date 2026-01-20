import {
  Catch,
  ArgumentsHost,
  HttpException,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WebSocketErrorCode, WsErrorResponse } from '@tainiex/shared-atlas';
import { Socket } from 'socket.io';

@Catch()
export class WebSocketExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WebSocketExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();

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

        message:
          typeof err === 'string'
            ? err
            : (err as Error).message || 'WebSocket Error',
        category: 'SERVER', // Default
        timestamp: new Date().toISOString(),
      };

      // Try to extract code if present
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (typeof err === 'object' && (err as any).code) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        structuredError.code = (err as any).code;
      }
    } else if (exception instanceof HttpException) {
      structuredError = {
        code: WebSocketErrorCode.INVALID_PAYLOAD, // Assuming HttpException is mostly validation
        message: exception.message,
        category: 'VALIDATION',
        details: exception.getResponse(),
        timestamp: new Date().toISOString(),
      };
    } else {
      // General Error
      structuredError = this.categorizeError(exception);
    }

    // Context logging
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const userId = client?.data?.user?.id || 'anonymous';
    const errorStack = (exception as Error).stack;
    this.logger.error(
      `WebSocket Error [User: ${userId}]: ${structuredError.message}`,
      errorStack,
    );

    return structuredError;
  }

  private categorizeError(error: any): WsErrorResponse {
    // JWT Errors
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (error.name === 'JsonWebTokenError') {
      return {
        code: WebSocketErrorCode.AUTH_TOKEN_INVALID,
        message: 'Invalid authentication token',
        category: 'AUTH',
        timestamp: new Date().toISOString(),
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (error.name === 'TokenExpiredError') {
      return {
        code: WebSocketErrorCode.AUTH_TOKEN_EXPIRED,
        message: 'Authentication token expired',
        category: 'AUTH',
        timestamp: new Date().toISOString(),
      };
    }

    // Database Errors (PostgreSQL)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (error.code?.startsWith('23')) {
      return {
        code: WebSocketErrorCode.DATABASE_ERROR,
        message: 'Database operation failed',
        category: 'SERVER',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        details: { dbCode: error.code },
        timestamp: new Date().toISOString(),
      };
    }

    // Default Server Error
    return {
      code: WebSocketErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      category: 'SERVER',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      details: { original: error.message },
      timestamp: new Date().toISOString(),
    };
  }
}
