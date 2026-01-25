/* eslint-disable @typescript-eslint/require-await */

import { Test, TestingModule } from '@nestjs/testing';
import { WeatherTool } from './weather.tool';
import { CacheModule } from '@nestjs/cache-manager';

global.fetch = jest.fn();

describe('WeatherTool', () => {
  let tool: WeatherTool;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.OPENWEATHER_API_KEY = 'test-key';

    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      providers: [WeatherTool],
    }).compile();

    tool = module.get<WeatherTool>(WeatherTool);
  });

  afterEach(() => {
    delete process.env.OPENWEATHER_API_KEY;
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  it('should throw error if API key is missing', async () => {
    delete process.env.OPENWEATHER_API_KEY;
    await expect(tool.execute({ city: 'London' })).rejects.toThrow(
      'OPENWEATHER_API_KEY missing',
    );
  });

  it('should call OpenWeather API if key is present', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'London',
        main: { temp: 15, humidity: 80 },
        weather: [{ description: 'cloudy' }],
        wind: { speed: 5 },
      }),
    });

    const result = await tool.execute({ city: 'London' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        'api.openweathermap.org/data/2.5/weather?q=London',
      ),
    );
    expect(result.city).toBe('London');
    expect(result.temperature).toBe(15);
  });
});
