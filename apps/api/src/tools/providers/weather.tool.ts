import { Inject, Logger } from '@nestjs/common';
import { IToolProvider } from '../../agent/interfaces/tool-provider.interface';
import { AgentTool } from '../../agent/decorators/agent-tool.decorator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { z } from 'zod';

interface WeatherArgs {
    city: string;
    unit?: 'celsius' | 'fahrenheit';
}

interface WeatherApiResponse {
    name: string;
    main: {
        temp: number;
        humidity: number;
    };
    weather: Array<{
        description: string;
    }>;
    wind: {
        speed: number;
    };
}

interface WeatherResult {
    city: string;
    temperature: number;
    unit: string | undefined;
    description: string | undefined;
    humidity: number;
    wind_speed: number;
}

@AgentTool({
    name: 'get_weather',
    description:
        'Get current weather for a city. Returns temperature, humidity, and simple description.',
    scope: 'global',
})
export class WeatherTool implements IToolProvider {
    name = 'get_weather';
    description =
        'Get current weather for a city. Returns temperature, humidity, and simple description.';

    private logger = new Logger(WeatherTool.name);

    // Define Schema using Zod or raw JSON Schema
    private zodSchema = z.object({
        city: z.string().describe('City name, e.g. Shanghai, San Francisco'),
        unit: z.enum(['celsius', 'fahrenheit']).optional().default('celsius'),
    });

    // Convert to JSON Schema compatibility
    parameters = {
        type: 'object',
        properties: {
            city: { type: 'string', description: 'City name' },
            unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                default: 'celsius',
            },
        },
        required: ['city'],
    };

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    /**
     * Check if API Key is configured
     */
    isAvailable(): boolean {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            this.logger.debug('OPENWEATHER_API_KEY not found. Tool disabled.');
            return false;
        }
        return true;
    }

    async execute(args: any): Promise<WeatherResult> {
        const validArgs = args as WeatherArgs;
        const { city, unit } = validArgs;
        const cacheKey = `weather:${city.toLowerCase()}:${unit}`;

        // Check Cache
        const cached = await this.cacheManager.get<WeatherResult>(cacheKey);
        if (cached) {
            this.logger.log(`Returning cached weather for ${city}`);
            return cached;
        }

        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            // Should not happen if isAvailable checks out, but double check
            throw new Error('OPENWEATHER_API_KEY missing');
        }

        const units = unit === 'fahrenheit' ? 'imperial' : 'metric';
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${apiKey}`;

        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 404) {
                throw new Error(`City '${city}' not found.`);
            }
            throw new Error(`Weather API Error: ${res.status} ${res.statusText}`);
        }

        const data = (await res.json()) as WeatherApiResponse;

        const result: WeatherResult = {
            city: data.name,
            temperature: data.main.temp,
            unit,
            description: data.weather[0]?.description,
            humidity: data.main.humidity,
            wind_speed: data.wind.speed,
        };

        // Cache for 10 minutes (600 seconds)
        await this.cacheManager.set(cacheKey, result, 600000);
        return result;
    }
}
