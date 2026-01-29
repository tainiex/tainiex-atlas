import { Logger } from '@nestjs/common';
import { IToolProvider } from '../../agent/interfaces/tool-provider.interface';
import { AgentTool } from '../../agent/decorators/agent-tool.decorator';

interface SearchArgs {
    query: string;
    max_results?: number;
}

interface TavilyResponse {
    answer?: string;
    results: Array<{
        title: string;
        url: string;
        content: string;
    }>;
}

interface SearchResult {
    query: string;
    answer?: string;
    results: Array<{
        title: string;
        url: string;
        content: string;
    }>;
}

@AgentTool({
    name: 'web_search',
    description:
        'Search the web for current information, news, or specific facts. Optimized for LLMs.',
    scope: 'global',
})
export class SearchTool implements IToolProvider {
    name = 'web_search';
    description =
        'Search the web for current information, news, or specific facts. Optimized for LLMs.';

    private logger = new Logger(SearchTool.name);

    parameters = {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'The search query string' },
            max_results: { type: 'number', default: 5 },
        },
        required: ['query'],
    };

    /**
     * Check if API Key is configured
     */
    isAvailable(): boolean {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
            this.logger.debug('TAVILY_API_KEY not found. SearchTool disabled.');
            return false;
        }
        return true;
    }

    async execute(args: any): Promise<SearchResult> {
        const { query, max_results } = args as SearchArgs;
        const apiKey = process.env.TAVILY_API_KEY;

        if (!apiKey) {
            throw new Error('TAVILY_API_KEY missing');
        }

        const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                max_results: max_results || 5, // Default to 5 if undefined
                search_depth: 'basic',
                include_answer: true,
            }),
        });

        if (!res.ok) {
            throw new Error(`Tavily API Error: ${res.status} ${res.statusText}`);
        }

        const data = (await res.json()) as TavilyResponse;
        return {
            query,
            answer: data.answer,
            results:
                data.results?.map(r => ({
                    title: r.title,
                    url: r.url,
                    content: r.content,
                })) || [],
        };
    }
}
