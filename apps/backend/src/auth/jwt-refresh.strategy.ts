import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: FastifyRequest) => {
          return request?.cookies?.refresh_token || null;
        },
        ExtractJwt.fromBodyField('refreshToken'),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey:
        configService.get<string>('JWT_REFRESH_SECRET') || 'refreshSecretKey',
      passReqToCallback: true,
    });
  }

  validate(req: FastifyRequest, payload: JwtPayload) {
    let refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      const body = req.body as { refreshToken?: string };
      if (body && body.refreshToken) {
        refreshToken = body.refreshToken;
      } else {
        const authHeader = req.headers.authorization;
        if (
          typeof authHeader === 'string' &&
          authHeader.split(' ')[0] === 'Bearer'
        ) {
          refreshToken = authHeader.split(' ')[1];
        }
      }
    }
    return {
      sub: payload.sub,
      username: payload.username,
      email: payload.email,
      refreshToken,
    };
  }
}
