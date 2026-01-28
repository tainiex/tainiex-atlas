import { User } from '../../users/user.entity';

export interface AuthResult {
  requiresInvite?: boolean;
  signupToken?: string;
  email?: string;
  picture?: string;
  user?: Partial<User>; // validateUser returns object without password
  tokens?: {
    access_token: string;
    refresh_token: string;
  };
}
