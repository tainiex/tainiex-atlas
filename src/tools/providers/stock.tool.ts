import { Injectable, Inject } from '@nestjs/common';
import { Tool } from '../interfaces/tool.interface';
import { z } from 'zod';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class StockTool extends Tool {
  name = 'get_stock_price';
  description = 'Get current stock price and change for a given symbol.';

  schema = z.object({
    symbol: z.string().describe('Stock symbol, e.g. MSFT, AAPL, GOOGL'),
  });

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    super();
  }

  protected async executeImpl(args: z.infer<typeof this.schema>): Promise<any> {
    const { symbol } = args;
    const cacheKey = `stock:${symbol.toUpperCase()}`;

    // Check Cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.log(`Returning cached stock for ${symbol}`);
      return cached;
    }

    const apiKey = process.env.ALPHAVANTAGE_API_KEY;

    if (!apiKey) {
      this.logger.warn('ALPHAVANTAGE_API_KEY not found. Returning MOCK data.');
      return {
        symbol,
        price: 150.0,
        change_percent: '+1.2%',
        latest_trading_day: '2023-10-27',
        source: 'Mock',
      };
    }

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Alpha Vantage API Error: ${res.status}`);
    }

    const data = await res.json();

    // Alpha Vantage often returns 200 OK even if error or rate limit
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

    const result = {
      symbol: quote['01. symbol'],
      price: parseFloat(quote['05. price']),
      change_percent: quote['10. change percent'],
      latest_trading_day: quote['07. latest trading day'],
    };

    // Cache for 1 minute (60 seconds) as stock prices move fast
    await this.cacheManager.set(cacheKey, result, 60000);
    return result;
  }
}
