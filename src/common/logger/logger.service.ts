import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';
import { createLogger, format, transports, Logger } from 'winston';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private logger: Logger;
  private context?: string;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    const logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';

    // Production: JSON format for structured logging
    // Development: Human-readable colored output
    const logFormat = isProduction
      ? format.combine(
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          format.errors({ stack: true }),
          format.json(),
        )
      : format.combine(
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          format.colorize(),
          format.printf(({ timestamp, level, message, context, ...meta }) => {
            const ctx = context
              ? `[${typeof context === 'string' ? context : JSON.stringify(context)}]`
              : '';
            const metaStr = Object.keys(meta).length
              ? JSON.stringify(meta)
              : '';
            return `${String(timestamp)} ${String(level)} ${ctx} ${String(message)} ${metaStr}`;
          }),
        );

    this.logger = createLogger({
      level: logLevel,
      format: logFormat,
      transports: [new transports.Console()],
      exitOnError: false,
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context: context || this.context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context: context || this.context });
  }

  // Backward compatibility: info() as alias for log()
  info(message: string, context?: string) {
    this.log(message, context);
  }
}
