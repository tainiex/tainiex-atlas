import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) => {
          return request?.cookies?.refresh_token;
        },
        ExtractJwt.fromBodyField('refreshToken'),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey:
        configService.get<string>('JWT_REFRESH_SECRET') || 'refreshSecretKey',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    let refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      if (req.body && req.body.refreshToken) {
        refreshToken = req.body.refreshToken;
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
