import { FastifyRequest } from 'fastify';
import { User } from '../../users/user.entity';

export interface AuthenticatedRequest extends FastifyRequest {
  user: User;
}
