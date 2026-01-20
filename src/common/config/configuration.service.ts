import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieSerializeOptions } from '@fastify/cookie';

/**
 * Environment Types
 */
export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Cookie Configuration Interface
 */
export interface CookieConfig {
  access: CookieSerializeOptions;
  refresh: CookieSerializeOptions;
}

/**
 * Unified Configuration Service
 * 统一配置服务 - 集中管理所有环境变量和派生配置
 *
 * 职责:
 * - 提供类型安全的配置访问
 * - 处理配置的默认值和类型转换
 * - 提供派生配置（如 Cookie 选项）
 * - 避免在业务代码中直接使用 process.env
 */
@Injectable()
export class ConfigurationService {
  constructor(private readonly configService: ConfigService) {}

  // ==================== 环境配置 ====================

  /**
   * Get current environment
   */
  get environment(): Environment {
    const env = this.configService.get<string>('NODE_ENV', 'development');
    return env as Environment;
  }

  /**
   * Check if running in production
   */
  get isProduction(): boolean {
    return this.environment === Environment.Production;
  }

  /**
   * Check if running in development
   */
  get isDevelopment(): boolean {
    return this.environment === Environment.Development;
  }

  // ==================== 服务器配置 ====================

  /**
   * Get server port
   */
  get port(): number {
    return this.configService.get<number>('PORT', 2020);
  }

  /**
   * Get API prefix
   */
  get apiPrefix(): string {
    return this.configService.get<string>('API_PREFIX', 'api');
  }

  // ==================== 日志配置 ====================

  /**
   * Get log level (for custom LoggerService)
   */
  get logLevel(): string {
    return this.configService.get<string>('LOG_LEVEL', 'info').toLowerCase();
  }

  // ==================== Cookie 配置 ====================

  /**
   * Get cookie domain
   */
  get cookieDomain(): string | undefined {
    return this.configService.get<string>('COOKIE_DOMAIN');
  }

  /**
   * Get access token max age (in seconds)
   * 开发环境: 60 秒（方便测试刷新逻辑）
   * 生产环境: 15 分钟
   */
  get accessTokenMaxAge(): number {
    return this.isProduction ? 15 * 60 : 60;
  }

  /**
   * Get refresh token max age (in seconds)
   * 固定 7 天
   */
  get refreshTokenMaxAge(): number {
    return 7 * 24 * 60 * 60;
  }

  /**
   * Get complete cookie configuration for access and refresh tokens
   * 获取完整的 Cookie 配置（访问令牌和刷新令牌）
   */
  getCookieConfig(): CookieConfig {
    const baseOptions: CookieSerializeOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      domain: this.cookieDomain,
      path: '/',
    };

    return {
      access: {
        ...baseOptions,
        maxAge: this.accessTokenMaxAge,
      },
      refresh: {
        ...baseOptions,
        maxAge: this.refreshTokenMaxAge,
      },
    };
  }

  // ==================== CORS 配置 ====================

  /**
   * Get raw CORS origin string from environment
   */
  get corsOrigin(): string {
    return this.configService.get<string>('CORS_ORIGIN', '');
  }

  /**
   * Parse CORS origins from comma-separated string
   * Supports:
   * - Exact match: "https://example.com"
   * - Wildcard: "https://*.example.com"
   * - Multiple: "https://a.com,https://b.com"
   *
   * @returns Array of strings or RegExp patterns
   */
  parseCorsOrigins(): Array<string | RegExp> {
    const rawConfig = this.corsOrigin;
    if (!rawConfig) {
      return [];
    }

    return rawConfig
      .split(',')
      .map((origin) => {
        const trimmed = origin.trim().replace(/^['"]|['"]$/g, ''); // Remove quotes

        if (trimmed === '*') {
          return trimmed;
        }

        // Convert wildcard to regex
        if (trimmed.includes('*')) {
          const regexString =
            '^' +
            trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') +
            '$';
          return new RegExp(regexString);
        }

        return trimmed;
      })
      .filter((origin) => origin); // Remove empty strings
  }

  /**
   * Check if an origin is allowed by CORS configuration
   * 检查某个来源是否被 CORS 配置允许
   */
  isOriginAllowed(requestOrigin: string): boolean {
    const allowedOrigins = this.parseCorsOrigins();

    return allowedOrigins.some((origin) => {
      if (typeof origin === 'string') {
        return origin === '*' || origin === requestOrigin;
      }
      // RegExp
      return origin.test(requestOrigin);
    });
  }

  // ==================== 数据库配置 ====================

  /**
   * Check if database SSL should be enabled
   * 默认值: 生产环境启用，其他环境禁用
   */
  get isDatabaseSslEnabled(): boolean {
    const dbSsl = this.configService.get<string>('DB_SSL');
    // If not explicitly set, default to true in production
    return dbSsl !== undefined ? dbSsl === 'true' : this.isProduction;
  }
}
