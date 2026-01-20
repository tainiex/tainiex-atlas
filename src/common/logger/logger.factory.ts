import { createLogger, format, transports, Logger } from 'winston';

/**
 * Create Winston logger instance with consistent configuration
 * 创建带统一配置的 Winston logger 实例
 */
export function createWinstonLogger(): Logger {
    const isProduction = process.env.NODE_ENV === 'production';
    const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

    const logFormat = isProduction
        ? format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.errors({ stack: true }),
            format.json(),
        )
        : format.combine(
            format.timestamp({ format: 'MM/DD/YYYY, HH:mm:ss Z' }), // 24-hour format with timezone
            format.colorize({ level: true }), // Only colorize the level
            format.printf(({ timestamp, level, message, context, ...meta }) => {
                const pid = process.pid;
                // Add yellow color to context (ANSI code: \x1b[33m for yellow, \x1b[0m to reset)
                const ctx = context
                    ? `\x1b[33m[${typeof context === 'string' ? context : JSON.stringify(context)}]\x1b[0m`
                    : '';
                const metaStr = Object.keys(meta).length
                    ? ` ${JSON.stringify(meta)}`
                    : '';
                // level already contains ANSI codes from colorize
                return `[Nest] ${pid} - ${timestamp}  ${level} ${ctx} ${message}${metaStr}`;
            }),
        );

    return createLogger({
        level: logLevel,
        format: logFormat,
        transports: [new transports.Console()],
        exitOnError: false,
    });
}
