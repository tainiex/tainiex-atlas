import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { FastifyRequest } from 'fastify';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        private usersService: UsersService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (request: FastifyRequest) => {
                    return request?.cookies?.access_token || null;
                },
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || 'secretKey',
        });
    }

    async validate(payload: JwtPayload) {
        // Fetch full user to include avatar
        const user = await this.usersService.findOneById(payload.sub);
        if (user && user.avatar) {
            // Sign the avatar URL if it's a GCS path
            const signedUrl = await this.usersService.getSignedUrl(user.avatar);
            if (signedUrl) {
                user.avatar = signedUrl;
            }
        }
        return user;
    }
}
