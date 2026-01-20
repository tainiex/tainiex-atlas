import { Controller, Get, HttpCode } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @HttpCode(200)
  healthCheck(): void {
    // Health check endpoint - returns 200 with no content
  }
}
