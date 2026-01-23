import { Injectable } from '@nestjs/common';
import { Tool } from '../interfaces/tool.interface';
import { z } from 'zod';

@Injectable()
export class WikipediaTool extends Tool {
  name = 'search_wikipedia';
  description =
    'Search Wikipedia for encyclopedic knowledge, definitions, and historical events.';

  schema = z.object({
    query: z.string().describe('The search query'),
    language: z.string().optional().default('en'),
  });

  protected async executeImpl(args: z.infer<typeof this.schema>): Promise<any> {
    const { query, language } = args;
    // Wiki API is free, no key needed.
    const endpoint = `https://${language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error(`Wikipedia API Error: ${res.status}`);
    }

    const data = await res.json();

    if (!data.query || !data.query.search || data.query.search.length === 0) {
      return { message: 'No results found on Wikipedia.' };
    }

    // Use the first result to get a snippet. Ideally, we should fetch the page content/summary.
    // Let's improve by fetching the summary of the top result.
    const topTitle = data.query.search[0].title;

    const summaryUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`;
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
