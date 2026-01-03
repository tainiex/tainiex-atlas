import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';

import { ConfigService } from '@nestjs/config';

import cookieParser from 'cookie-parser';
import { ClassSerializerInterceptor } from '@nestjs/common';

import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ type: ['application/json', 'text/plain'] }));
  app.use(urlencoded({ extended: true }));
  app.use(cookieParser());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
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
