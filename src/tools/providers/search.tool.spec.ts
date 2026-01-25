import { Test, TestingModule } from '@nestjs/testing';
import { SearchTool } from './search.tool';
import { ConfigService } from '@nestjs/config';

// Global fetch mock
global.fetch = jest.fn();

describe('SearchTool', () => {
    let tool: SearchTool;

    beforeEach(async () => {
        jest.clearAllMocks();
        process.env.TAVILY_API_KEY = 'test-key'; // Default to having key

        const module: TestingModule = await Test.createTestingModule({
            providers: [SearchTool],
        }).compile();

        tool = module.get<SearchTool>(SearchTool);
    });

    afterEach(() => {
        delete process.env.TAVILY_API_KEY;
    });

    it('should be defined', () => {
        expect(tool).toBeDefined();
    });

    it('should throw error if API key is missing', async () => {
        delete process.env.TAVILY_API_KEY;
        await expect(tool.execute({ query: 'test' })).rejects.toThrow('TAVILY_API_KEY missing');
    });

    it('should call generic search API if key is present', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                answer: 'Paris is the capital of France',
                results: [{ title: 'Paris', url: 'http://paris.com', content: 'City of light' }]
            })
        });

        const result = await tool.execute({ query: 'capital of france' });

        expect(global.fetch).toHaveBeenCalledWith('https://api.tavily.com/search', expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('capital of france')
        }));
        expect(result.answer).toBe('Paris is the capital of France');
    });

    it('should throw error if API call fails', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
        });

        await expect(tool.execute({ query: 'fail' })).rejects.toThrow('Tavily API Error: 500 Internal Server Error');
    });
});
