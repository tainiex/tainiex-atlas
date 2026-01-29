import { FastifyRequest } from 'fastify';

export interface AuthenticatedRefreshRequest extends FastifyRequest {
    user: {
        sub: string;
        username: string;
        email: string;
        refreshToken: string;
    };
}
