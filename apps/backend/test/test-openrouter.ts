import * as dotenv from 'dotenv';
dotenv.config();
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../src/common/logger/logger.service';
import { OpenRouterAdapter } from '../src/llm/adapters/openrouter.adapter';

async function run() {
  // Mock ConfigService
  const configService = {
    get: (key: string) => {
      if (key === 'OPENROUTER_API_KEY') return process.env.OPENROUTER_API_KEY;
      return null;
    },
  } as unknown as ConfigService;

  // Mock LoggerService
  const logger = {
    info: (msg: string) => console.log('INFO:', msg),
    error: (msg: string, trace: string) => console.error('ERROR:', msg, trace),
    warn: (msg: string) => console.warn('WARN:', msg),
    debug: (msg: string) => console.log('DEBUG:', msg),
  } as unknown as LoggerService;

  const modelName = 'z-ai/glm-4.5-air:free'; // Example OpenRouter model

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Please set OPENROUTER_API_KEY env var');
    process.exit(1);
  }

  console.log('Creating adapter...');
  const adapter = new OpenRouterAdapter(configService, logger, modelName);

  console.log('Initializing...');
  await adapter.initialize();

  console.log('Testing generateContent...');
  try {
    const response = await adapter.generateContent(
      "Hello, say 'OpenRouter works!'",
    );
    console.log('Response:', response);
  } catch (e) {
    console.error('generateContent failed', e);
  }

  console.log('Testing streamChat...');
  try {
    const stream = adapter.streamChat([], 'Count to 3');
    for await (const chunk of stream) {
      process.stdout.write(chunk);
    }
    console.log('\nStream finished.');
  } catch (e) {
    console.error('streamChat failed', e);
  }
}

void run();
