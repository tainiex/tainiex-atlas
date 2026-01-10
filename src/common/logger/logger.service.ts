import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

@Injectable()
export class LoggerService implements NestLoggerService {
    private logLevel: LogLevel;
    private readonly levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];

    constructor(private configService: ConfigService) {
        const configuredLevel = this.configService.get<string>('LOG_LEVEL', 'info');
        this.logLevel = this.parseLogLevel(configuredLevel);
    }

    private parseLogLevel(level: string): LogLevel {
        const normalizedLevel = level.toLowerCase() as LogLevel;
        if (this.levels.includes(normalizedLevel)) {
            return normalizedLevel;
        }
        return LogLevel.INFO;
    }

    debug(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }

    info(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.log(`[INFO] ${message}`, ...args);
        }
    }

    warn(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    }

    error(message: string, error?: any, ...args: any[]): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(`[ERROR] ${message}`, error, ...args);
        }
    }

    // NestJS LoggerService interface compatibility
    log(message: string, ...optionalParams: any[]) {
        this.info(message, ...optionalParams);
    }

    verbose(message: string, ...optionalParams: any[]) {
        this.debug(message, ...optionalParams);
    }

    private shouldLog(level: LogLevel): boolean {
        return this.levels.indexOf(level) >= this.levels.indexOf(this.logLevel);
    }
}
