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

async function bootstrap() {
  // Configure logger based on environment
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevels: LogLevel[] = isProduction
    ? ['error', 'warn'] // Production: Only errors and warnings
    : ['log', 'error', 'warn', 'debug', 'verbose']; // Development: All logs

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: isProduction ? false : true, // Simple logger config for Fastify
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
    const configService = app.get(ConfigService);
    const globalPrefix = configService.get<string>('API_PREFIX', 'api');
    app.setGlobalPrefix(globalPrefix);

    // CORS Configuration
    const corsOrigin = configService.get<string>('CORS_ORIGIN');
    const isProd = configService.get('NODE_ENV') === 'production';

    if (corsOrigin) {
      const origins = corsOrigin.split(',').map((origin) => {
        const trimmed = origin.trim();
        if (trimmed === '*') return trimmed;
        // If containing wildcard but not just '*', convert to Regex
        if (trimmed.includes('*')) {
          // Escape regex special chars except *
          const regexString =
            '^' +
            trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') +
            '$';
          return new RegExp(regexString);
        }
        return trimmed;
      });

      app.enableCors({
        origin: origins,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
      });
      console.log(`CORS enabled for origins: ${corsOrigin}`);
    } else if (!isProd) {
      // Allow all in development/debug if not explicitly set
      app.enableCors({ origin: '*' });
      console.log('CORS enabled for all origins (Development Mode)');
    } else {
      console.log('CORS disabled (Production Mode: No CORS_ORIGIN set)');
    }

    console.log('Environment PORT:', process.env.PORT);
    const port = configService.get<number>('PORT', 2020);
    console.log('Configured Port:', port);

    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: ${await app.getUrl()}`);
  } catch (error) {
    console.error('Bootstrap failed:', error);
    process.exit(1);
  }
}
bootstrap();
