import { Injectable, Logger } from '@nestjs/common';
import { IToolProvider } from '../../agent/interfaces/tool-provider.interface';
import { AgentTool } from '../../agent/decorators/agent-tool.decorator';

@AgentTool({
  name: 'search_wikipedia',
  description: 'Search Wikipedia for encyclopedic knowledge, definitions, and historical events.',
  scope: 'global'
})
export class WikipediaTool implements IToolProvider {
  name = 'search_wikipedia';
  description = 'Search Wikipedia for encyclopedic knowledge, definitions, and historical events.';

  private logger = new Logger(WikipediaTool.name);

  parameters = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      language: { type: 'string', default: 'en' }
    },
    required: ['query']
  };

  /**
   * Wikipedia is free, so it's always available.
   */
  isAvailable(): boolean {
    return true;
  }

  async execute(args: any): Promise<any> {
    const { query, language } = args;
    const lang = language || 'en';
    const endpoint = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error(`Wikipedia API Error: ${res.status}`);
    }

    const data = await res.json();

    if (!data.query || !data.query.search || data.query.search.length === 0) {
      return { message: 'No results found on Wikipedia.' };
    }

    const topTitle = data.query.search[0].title;
    const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`;
    const summaryRes = await fetch(summaryUrl);

    if (summaryRes.ok) {
      const summaryData = await summaryRes.json();
      return {
        title: summaryData.title,
        extract: summaryData.extract,
        url: summaryData.content_urls?.desktop?.page,
        description: summaryData.description,
      };
    }

    // Fallback to simple list if summary fails
    return {
      results: data.query.search.map((s: any) => ({
        title: s.title,
        snippet: s.snippet.replace(/<[^>]*>/g, ''), // remove html tags
      })),
    };
  }
}
