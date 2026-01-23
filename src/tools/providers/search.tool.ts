import { Injectable } from '@nestjs/common';
import { Tool } from '../interfaces/tool.interface';
import { z } from 'zod';

@Injectable()
export class SearchTool extends Tool {
  name = 'web_search';
  description =
    'Search the web for current information, news, or specific facts. Optimized for LLMs.';

  schema = z.object({
    query: z.string().describe('The search query string'),
    max_results: z.number().int().min(1).max(10).optional().default(5),
  });

  protected async executeImpl(args: z.infer<typeof this.schema>): Promise<any> {
    const { query, max_results } = args;
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      this.logger.warn('TAVILY_API_KEY not found. Returning MOCK data.');
      return {
        query,
        results: [
          {
            title: 'Mock Result 1',
            url: 'http://example.com/1',
            content: 'This is a mock search result content.',
          },
          {
            title: 'Mock Result 2',
            url: 'http://example.com/2',
            content: 'Another mock result for testing.',
          },
        ],
        source: 'Mock',
      };
    }

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results,
        search_depth: 'basic',
        include_answer: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Tavily API Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return {
      query,
      answer: data.answer,
      results: data.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content,
      })),
    };
  }
}
