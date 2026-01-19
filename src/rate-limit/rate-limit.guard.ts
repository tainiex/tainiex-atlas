import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Get metadata (Decorator options)
    const rateLimit = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rateLimit) {
      return true; // No limit defined
    }

    // 2. Identify Context (HTTP vs WebSocket)
    const type = context.getType();
    let key = '';
    let ip = '';

    if (type === 'http') {
      const req = context.switchToHttp().getRequest();
      ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      // Use User ID if available, else IP
      key = req.user ? `user:${req.user.id}` : `ip:${ip}`;
      // Add handler name to key to isolate limits per endpoint?
      // Usually global limit per user is better, but let's stick to per endpoint if desired.
      // For now, let's make it scoped to the endpoint to be safe:
      const handlerName = context.getHandler().name;
      key = `${key}:${handlerName}`;
    } else if (type === 'ws') {
      const client = context.switchToWs().getClient();
      const data = client.data || {};
      ip = client.handshake?.address || 'unknown';
      key = data.user ? `user:${data.user.id}` : `ip:${ip}`;
      const handlerName = context.getHandler().name;
      key = `${key}:${handlerName}`;
    } else {
      return true; // Ignore other contexts like RPC
    }

    // 3. Check Rate Limit
    const isAllowed = await this.rateLimitService.isAllowed(
      key,
      rateLimit.points,
      rateLimit.duration,
    );

    if (!isAllowed) {
      if (type === 'http') {
        throw new HttpException(
          'Too Many Requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      } else {
        throw new WsException('Rate limit exceeded');
      }
    }

    return true;
  }
}
