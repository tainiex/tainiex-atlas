import { Injectable, Inject } from '@nestjs/common'; // Fixed import
import { Tool } from '../interfaces/tool.interface';
import { z } from 'zod';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class WeatherTool extends Tool {
  name = 'get_weather';
  description =
    'Get current weather for a city. Returns temperature, humidity, and simple description.';

  schema = z.object({
    city: z.string().describe('City name, e.g. Shanghai, San Francisco'),
    unit: z.enum(['celsius', 'fahrenheit']).optional().default('celsius'),
  });

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    super();
  }

  protected async executeImpl(args: z.infer<typeof this.schema>): Promise<any> {
    const { city, unit } = args;
    const cacheKey = `weather:${city.toLowerCase()}:${unit}`;

    // Check Cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.log(`Returning cached weather for ${city}`);
      return cached;
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      // Fallback for dev/demo if no key
      this.logger.warn('OPENWEATHER_API_KEY not found. Returning MOCK data.');
      return {
        city,
        temperature: 25,
        unit,
        description: 'Sunny (Mock Data)',
        humidity: 60,
        source: 'Mock',
      };
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

    const data = await res.json();

    const result = {
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
