import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';

import { ConfigService } from '@nestjs/config';

import {
  ClassSerializerInterceptor,
  LogLevel,
  ValidationPipe,
} from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { ConfigurationService } from './common/config/configuration.service';

async function bootstrap() {
  // Get configuration service to determine log levels
  const tempApp = await NestFactory.createApplicationContext(AppModule);
  const configService = tempApp.get(ConfigurationService);

  const logLevels: LogLevel[] = configService.isProduction
    ? ['error', 'warn'] // Production: Only errors and warnings
    : ['log', 'error', 'warn', 'debug', 'verbose']; // Development: All logs

  await tempApp.close();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: configService.isProduction ? false : true,
    }),
    {
      logger: logLevels,
    },
  );

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
      console.log(`CORS enabled for origins: ${corsOrigin}`);
    } else if (!appConfigService.isProduction) {
      // Allow all in development/debug if not explicitly set
      app.enableCors({ origin: '*' });
      console.log('CORS enabled for all origins (Development Mode)');
    } else {
      console.log('CORS disabled (Production Mode: No CORS_ORIGIN set)');
    }

    console.log('Environment PORT:', process.env.PORT);
    const port = appConfigService.port;
    console.log('Configured Port:', port);

    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: ${await app.getUrl()}`);
  } catch (error) {
    console.error('Bootstrap failed:', error);
    process.exit(1);
  }
}
void bootstrap();
