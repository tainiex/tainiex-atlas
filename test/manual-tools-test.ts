import { Test, TestingModule } from '@nestjs/testing';
import { ToolsModule } from '../src/tools/tools.module';
import { ToolsService } from '../src/tools/tools.service';

import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { JwtModule } from '@nestjs/jwt';

async function bootstrap() {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      ClsModule.forRoot({
        global: true,
        middleware: { mount: true },
      }),
      JwtModule.register({ secret: 'test-secret', global: true }),
      ToolsModule,
    ],
  }).compile();

  const toolsService = module.get<ToolsService>(ToolsService);
  await module.init();

  console.log('Starting Tools Verification...');

  // 1. List Tools
  const definitions = toolsService.getToolsDefinitions();
  console.log(`Found ${definitions.length} tools.`);
  console.log(JSON.stringify(definitions, null, 2));

  // 2. Test Weather (Mock if no key)
  try {
    console.log('Testing get_weather...');
    const weather = await toolsService.executeTool('get_weather', {
      city: 'Shanghai',
    });
    console.log('Weather Result:', JSON.stringify(weather, null, 2));
  } catch (e) {
    console.error('Weather Test Failed:', e);
  }

  // 3. Test Search (Mock if no key)
  try {
    console.log('Testing web_search...');
    const search = await toolsService.executeTool('web_search', {
      query: 'NestJS Framework',
    });
    console.log('Search Result:', JSON.stringify(search, null, 2));
  } catch (e) {
    console.error('Search Test Failed:', e);
  }

  // 4. Test Wikipedia (Live)
  try {
    console.log('Testing search_wikipedia...');
    const wiki = await toolsService.executeTool('search_wikipedia', {
      query: 'Artificial Intelligence',
    });
    console.log(
      'Wikipedia Result:',
      JSON.stringify(wiki, null, 2).substring(0, 500) + '...',
    );
  } catch (e) {
    console.error('Wikipedia Test Failed:', e);
  }

  // 5. Test Stock (Mock if no key)
  try {
    console.log('Testing get_stock_price...');
    const stock = await toolsService.executeTool('get_stock_price', {
      symbol: 'MSFT',
    });
    console.log('Stock Result:', JSON.stringify(stock, null, 2));
  } catch (e) {
    console.error('Stock Test Failed:', e);
  }

  await module.close();
}

bootstrap();
