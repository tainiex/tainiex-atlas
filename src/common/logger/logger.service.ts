import {
  Injectable,
  LoggerService as NestLoggerService,
} from '@nestjs/common';
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
