import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';

import {
  ClassSerializerInterceptor,
  ValidationPipe,
  LoggerService as NestLoggerService,
} from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { ConfigurationService } from './common/config/configuration.service';
import { LoggerService } from './common/logger/logger.service';
import { createWinstonLogger } from './common/logger/logger.factory';

async function bootstrap() {
  // Create a Winston logger instance for NestJS framework logs using shared factory
  // 使用共享工厂为 NestJS 框架日志创建 Winston logger 实例
  const winstonLogger = createWinstonLogger();

  // Create NestJS LoggerService wrapper for Winston
  class WinstonLogger implements NestLoggerService {
    log(message: string, context?: string) {
      winstonLogger.info(message, { context });
    }
    error(message: string, trace?: string, context?: string) {
      winstonLogger.error(message, { context, trace });
    }
    warn(message: string, context?: string) {
      winstonLogger.warn(message, { context });
    }
    debug(message: string, context?: string) {
      winstonLogger.debug(message, { context });
    }
    verbose(message: string, context?: string) {
      winstonLogger.verbose(message, { context });
    }
  }

  const customLogger = new WinstonLogger();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // Disable Fastify logger, use Winston LoggerService instead
    }),
    {
      logger: customLogger, // Use Winston logger for NestJS framework
    },
  );

  // Also get the injected LoggerService for application use
  const appLogger = app.get(LoggerService);
  appLogger.setContext('NestApplication');
  app.useLogger(appLogger);

  await app.register(fastifyCookie);
  await app.register(fastifyMultipart);

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  try {
    // Re-fetch config service from the actual app instance
    const appConfigService = app.get(ConfigurationService);
    const globalPrefix = appConfigService.apiPrefix;
    app.setGlobalPrefix(globalPrefix);

    // CORS Configuration
    const corsOrigin = appConfigService.corsOrigin;

    if (corsOrigin) {
      const origins = appConfigService.parseCorsOrigins();

      app.enableCors({
        origin: origins,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
      });
      appLogger.log(`CORS enabled for origins: ${corsOrigin}`);
    } else if (!appConfigService.isProduction) {
      // Allow all in development/debug if not explicitly set
      app.enableCors({ origin: '*' });
      appLogger.log('CORS enabled for all origins (Development Mode)');
    } else {
      appLogger.log('CORS disabled (Production Mode: No CORS_ORIGIN set)');
    }

    const port = appConfigService.port;
    appLogger.log(`Starting server on port ${port}...`);

    await app.listen(port, '0.0.0.0');
    appLogger.log(`Application is running on: ${await app.getUrl()}`);
  } catch (error) {
    appLogger.error(
      'Bootstrap failed:',
      error instanceof Error ? error.stack : String(error),
    );
    process.exit(1);
  }
}
void bootstrap();
