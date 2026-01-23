import { Test, TestingModule } from '@nestjs/testing';
import { WikipediaTool } from './wikipedia.tool';

global.fetch = jest.fn();

describe('WikipediaTool', () => {
    let tool: WikipediaTool;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [WikipediaTool],
        }).compile();

        tool = module.get<WikipediaTool>(WikipediaTool);
    });

    it('should be defined', () => {
        expect(tool).toBeDefined();
    });

    it('should call Wikipedia API and return Summary (happy path)', async () => {
        const mockSearchResponse = {
            query: {
                search: [
                    { title: 'AI', snippet: '...', pageid: 1 }
                ]
            }
        };

        const mockSummaryResponse = {
            title: 'AI',
            extract: 'Artificial Intelligence is...',
            content_urls: { desktop: { page: 'http://wiki/AI' } },
            description: 'Field of CS'
        };

        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSearchResponse
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSummaryResponse
            });

        const result = await tool.execute({ query: 'AI' });

        expect(result.title).toBe('AI');
        expect(result.extract).toBe('Artificial Intelligence is...');
    });

    it('should fallback to list if Summary fetch fails', async () => {
        const mockSearchResponse = {
            query: {
                search: [
                    { title: 'AI', snippet: '<span>snippet</span>', pageid: 1 }
                ]
            }
        };

        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSearchResponse
            })
            .mockResolvedValueOnce({
                ok: false // Summary fails
            });

        const result = await tool.execute({ query: 'AI' });

        expect(result.results.length).toBe(1);
        expect(result.results[0].title).toBe('AI');
        expect(result.results[0].snippet).toBe('snippet'); // HTML removed
    });

    it('should handle API errors (Initial Search)', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 500
        });

        await expect(tool.execute({ query: 'fail' })).rejects.toThrow('Wikipedia API Error: 500');
    });

    it('should handle empty results', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ query: { search: [] } })
        });

        const result = await tool.execute({ query: 'empty' });
        expect(result).toEqual({ message: 'No results found on Wikipedia.' });
    });
});
