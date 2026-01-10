import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';

export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

@Injectable()
export class LoggerService implements NestLoggerService {
    private logger: winston.Logger;

    constructor(private configService: ConfigService) {
        const isProduction = this.configService.get('NODE_ENV') === 'production';
        const configuredLevel = this.configService.get<string>('LOG_LEVEL', 'info');

        this.logger = winston.createLogger({
            level: configuredLevel.toLowerCase(),
            format: isProduction
                ? winston.format.json()
                : winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.colorize(),
                    winston.format.simple()
                ),
            transports: [new winston.transports.Console()],
        });
    }

    log(message: string, ...optionalParams: any[]) {
        this.logger.info(message, { context: optionalParams[0], args: optionalParams.slice(1) });
    }

    error(message: string, ...optionalParams: any[]) {
        this.logger.error(message, { context: optionalParams[0], trace: optionalParams[1], args: optionalParams.slice(2) });
    }

    warn(message: string, ...optionalParams: any[]) {
        this.logger.warn(message, { context: optionalParams[0], args: optionalParams.slice(1) });
    }

    debug(message: string, ...optionalParams: any[]) {
        this.logger.debug(message, { context: optionalParams[0], args: optionalParams.slice(1) });
    }

    verbose(message: string, ...optionalParams: any[]) {
        this.logger.verbose(message, { context: optionalParams[0], args: optionalParams.slice(1) });
    }

    // Compatibility methods for existing usage "this.logger.info"
    info(message: string, ...args: any[]): void {
        this.logger.info(message, { args });
    }
}
