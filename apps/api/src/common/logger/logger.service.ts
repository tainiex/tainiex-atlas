import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { Logger } from 'winston';
import { ConfigurationService } from '../config/configuration.service';
import { createWinstonLogger } from './logger.factory';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: Logger;
  private context?: string;

  constructor(private readonly configService: ConfigurationService) {
    // Use shared Winston logger factory
    this.logger = createWinstonLogger();
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: unknown, context?: string) {
    let traceStr: string | undefined;
    if (trace instanceof Error) {
      traceStr = trace.stack;
    } else if (typeof trace === 'string') {
      traceStr = trace;
    } else if (trace !== null && trace !== undefined) {
      try {
        traceStr = JSON.stringify(trace);
      } catch {
        // Fallback to String() for objects that can't be JSON.stringified
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        traceStr = String(trace as object);
      }
    }
    this.logger.error(message, {
      trace: traceStr,
      context: context || this.context,
    });
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
