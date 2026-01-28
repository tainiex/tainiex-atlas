import { Inject, Logger } from '@nestjs/common';
import { IToolProvider } from '../../agent/interfaces/tool-provider.interface';
import { AgentTool } from '../../agent/decorators/agent-tool.decorator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

interface StockArgs {
  symbol: string;
}

interface AlphaVantageResponse {
  'Error Message'?: string;
  Note?: string;
  'Global Quote'?: {
    '01. symbol': string;
    '05. price': string;
    '10. change percent': string;
    '07. latest trading day': string;
  };
}

interface StockResult {
  symbol: string;
  price: number;
  change_percent: string;
  latest_trading_day: string;
}

@AgentTool({
  name: 'get_stock_price',
  description: 'Get current stock price and change for a given symbol.',
  scope: 'global',
})
export class StockTool implements IToolProvider {
  name = 'get_stock_price';
  description = 'Get current stock price and change for a given symbol.';

  private logger = new Logger(StockTool.name);

  parameters = {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Stock symbol, e.g. MSFT, AAPL' },
    },
    required: ['symbol'],
  };

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Check if API Key is configured
   */
  isAvailable(): boolean {
    const apiKey = process.env.ALPHAVANTAGE_API_KEY;
    if (!apiKey) {
      this.logger.debug('ALPHAVANTAGE_API_KEY not found. StockTool disabled.');
      return false;
    }
    return true;
  }

  async execute(args: any): Promise<StockResult> {
    const { symbol } = args as StockArgs;
    const cacheKey = `stock:${symbol.toUpperCase()}`;

    // Check Cache
    const cached = await this.cacheManager.get<StockResult>(cacheKey);
    if (cached) {
      this.logger.log(`Returning cached stock for ${symbol}`);
      return cached;
    }

    const apiKey = process.env.ALPHAVANTAGE_API_KEY;

    if (!apiKey) {
      throw new Error('ALPHAVANTAGE_API_KEY missing');
    }

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Alpha Vantage API Error: ${res.status}`);
    }

    const data = (await res.json()) as unknown as AlphaVantageResponse;

    if (data['Error Message']) {
      throw new Error(`Stock API Error: ${data['Error Message']}`);
    }
    if (data['Note']) {
      throw new Error(`Stock API Limit Reached: ${data['Note']}`);
    }

    const quote = data['Global Quote'];
    if (!quote || Object.keys(quote).length === 0) {
      throw new Error(`Symbol '${symbol}' not found.`);
    }

    const result: StockResult = {
      symbol: quote['01. symbol'],
      price: parseFloat(quote['05. price']),
      change_percent: quote['10. change percent'],
      latest_trading_day: quote['07. latest trading day'],
    };

    // Cache for 1 minute (60 seconds)
    await this.cacheManager.set(cacheKey, result, 60000);
    return result;
  }
}
