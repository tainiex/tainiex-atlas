import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { Storage, StorageOptions } from '@google-cloud/storage';
import { InvitationService } from '../invitation/invitation.service';
import * as jwksClient from 'jwks-rsa';
import { decode, verify } from 'jsonwebtoken';

import { GoogleLoginDto } from '@tainiex/shared-atlas';
import { AuthResult } from './interfaces/auth-result.interface';
import { MicrosoftJwtPayload } from './interfaces/microsoft-jwt-payload.interface';
import { SignupPayload } from './interfaces/signup-payload.interface';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  private googleClientId: string;
  private googleClientSecret: string;
  private googleAndroidClientId: string;
  private googleIosClientId: string;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private invitationService: InvitationService,
    private logger: LoggerService,
  ) {
    this.logger.setContext(AuthService.name);
    this.googleClientId =
      this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    this.googleClientSecret =
      this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    this.googleAndroidClientId =
      this.configService.get<string>('GOOGLE_ANDROID_CLIENT_ID') || '';
    this.googleIosClientId =
      this.configService.get<string>('GOOGLE_IOS_CLIENT_ID') || '';

    this.googleClient = new OAuth2Client(
      this.googleClientId,
      this.googleClientSecret,
      this.configService.get<string>('GOOGLE_REDIRECT_URI') || 'postmessage',
    );
  }

  generateRandomUsername(email?: string): string {
    const base = email ? email.split('@')[0] : 'user';
    const cleanBase = base.replace(/[^a-zA-Z0-9]/g, '');
    const randomSuffix = uuidv4().split('-')[0];
    return `${cleanBase}_${randomSuffix}`;
  }

  async generateTokens(user: User) {
    const payload = {
      username: user.username,
      sub: user.id,
      email: user.email,
    };

    // In development, use 60s for access token to test refresh logic
    // 在开发环境中，使用 60 秒的 access token 以测试刷新逻辑
    const isDevelopment =
      this.configService.get<string>('NODE_ENV') !== 'production';
    const accessTokenExpiry = isDevelopment ? '60s' : '15m';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessTokenExpiry,
        secret: this.configService.get<string>('JWT_SECRET'),
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: '7d',
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'refreshSecretKey',
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.update(userId, { hashedRefreshToken: hash });
  }

  async login(user: User) {
    const tokens = await this.generateTokens(user);
    await this.updateRefreshToken(user.id, tokens.refresh_token);
    return tokens;
  }

  async refreshTokens(userId: string, refreshToken: string) {
    // 验证用户存在
    const user = await this.usersService.findOneById(userId);
    if (!user || !user.hashedRefreshToken) {
      throw new ForbiddenException('Access Denied');
    }

    // 验证 refresh token 匹配
    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );

    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied');
    }

    // 生成新的 token 对
    const tokens = await this.generateTokens(user);

    // Disabling Refresh Token Rotation to prevent race conditions
    // Reuse the existing refresh token instead of sending the new one
    tokens.refresh_token = refreshToken;

    // Skip updating the database/token rotation
    // await this.updateRefreshToken(user.id, tokens.refresh_token);

    return tokens;
  }

  async googleLogin(
    dto: GoogleLoginDto,
    isMobile: boolean = false,
  ): Promise<AuthResult> {
    let idToken = dto.idToken;

    try {
      // If code is provided, exchange it for tokens (Web Flow)
      if (dto.code) {
        console.log(
          `[GoogleLogin] Exchanging code for tokens. Code length: ${dto.code.length}, isMobile: ${isMobile}`,
        );

        try {
          let googleTokens;

          if (isMobile) {
            // For mobile (serverAuthCode), redirect_uri must be null (or empty string depending on client lib)
            // 'null' effectively removes the parameter which is correct for Android flow
            const mobileClient = new OAuth2Client(
              this.googleClientId,
              this.googleClientSecret,
            );
            // Explicitly set redirect_uri to null for mobile
            const response = await mobileClient.getToken({
              code: dto.code,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              redirect_uri: null as any,
            });
            googleTokens = response.tokens;
            this.logger.log('[GoogleLogin] Mobile token exchange successful.');
          } else {
            // Standard Web Flow (uses postmessage or configured URI)
            const response = await this.googleClient.getToken(dto.code);
            googleTokens = response.tokens;
            this.logger.log('[GoogleLogin] Standard token exchange successful.');
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          idToken = googleTokens.id_token || undefined;
        } catch (error) {
          const tokenError = error as Error;
          console.error(
            `[GoogleLogin] Token exchange failed (isMobile=${isMobile}):`,
            tokenError.message,
          );

          // If we weren't in mobile mode but got a mismatch, retry as mobile (fallback)
          if (
            !isMobile &&
            tokenError.message &&
            tokenError.message.includes('redirect_uri_mismatch')
          ) {
            console.log(
              '[GoogleLogin] Redirect URI mismatch detected on legacy flow. Retrying with mobile configuration...',
            );
            try {
              const mobileClient = new OAuth2Client(
                this.googleClientId,
                this.googleClientSecret,
              );
              const { tokens } = await mobileClient.getToken({
                code: dto.code,

                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                redirect_uri: null as any,
              });
              idToken = tokens.id_token || undefined;
              console.log(
                '[GoogleLogin] Retry: Mobile token exchange successful.',
              );
            } catch (mobileError) {
              console.error(
                '[GoogleLogin] Retry failed:',
                (mobileError as Error).message,
              );
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              if (mobileError.response?.data) {
                console.error(
                  '[GoogleLogin] Mobile error details:',
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  JSON.stringify(mobileError.response.data),
                );
              }
              // If retry failed with invalid_grant, it's likely because the code was consumed by the first attempt.
              throw tokenError;
            }
          } else {
            throw new UnauthorizedException(
              `Google token exchange failed: ${tokenError.message}`,
            );
          }
        }
      }

      if (!idToken) {
        throw new UnauthorizedException(
          'Google login failed: No ID token provided or returned',
        );
      }

      // Verify the ID token
      // For mobile, audience might be different (Android/iOS Client ID)
      // For web, it's the Web Client ID
      this.logger.log('[GoogleLogin] Verifying ID token...');
      const ticket = await this.googleClient.verifyIdToken({
        idToken: idToken,
        audience: [
          this.googleClientId,
          this.googleAndroidClientId,
          this.googleIosClientId,
        ].filter(Boolean), // Allow multiple audiences
      });
      const googlePayload = ticket.getPayload();

      if (!googlePayload) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      return await this.processGoogleLogin(googlePayload);
    } catch (error) {
      this.logger.error('[GoogleLogin] Error:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        `Google login process failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async processGoogleLogin(
    googlePayload: TokenPayload,
  ): Promise<AuthResult> {
    const { email, picture } = googlePayload;

    if (!email) {
      throw new UnauthorizedException('Google token missing email');
    }

    let user = await this.usersService.findOneByEmail(email);

    if (!user) {
      // User does not exist.
      const signupPayload = {
        email,
        picture,
        type: 'google_signup_init',
      };

      const signupToken = await this.jwtService.signAsync(signupPayload, {
        expiresIn: '10m',
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      return {
        requiresInvite: true,
        email,
        picture,
        signupToken,
      };
    }

    // If user exists, proceed with login
    if (!user.avatar && picture) {
      const newAvatar = await this.uploadAvatarToGCS(picture, user.username);
      if (newAvatar) {
        user = await this.usersService.update(user.id, { avatar: newAvatar });
      }
    }

    const tokens = await this.generateTokens(user);
    await this.updateRefreshToken(user.id, tokens.refresh_token);

    if (user.avatar) {
      const signedUrl = await this.usersService.getSignedUrl(user.avatar);
      if (signedUrl) {
        user.avatar = signedUrl;
      }
    }

    return { user, tokens };
  }

  async microsoftLogin(idToken: string): Promise<AuthResult> {
    // 1. Verify the ID token

    const decodedHeader = decode(idToken, { complete: true }) as {
      header: { kid: string };
    } | null;

    if (!decodedHeader || !decodedHeader.header || !decodedHeader.header.kid) {
      throw new UnauthorizedException('Invalid Microsoft token header');
    }

    const client = jwksClient.default({
      jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    });

    const getKey = (header, callback) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      client.getSigningKey(header.kid, (err, key) => {
        const signingKey = key?.getPublicKey();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        callback(null, signingKey);
      });
    };

    const azureClientId = this.configService.get<string>('AZURE_CLIENT_ID');

    let payload: MicrosoftJwtPayload;
    try {
      payload = await new Promise<MicrosoftJwtPayload>((resolve, reject) => {
        verify(
          idToken,
          getKey,
          {
            audience: azureClientId,
            // issuer: 'https://login.microsoftonline.com/{tenantid}/v2.0', // Optional: strict issuer check if needed
            algorithms: ['RS256'],
          },
          (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded as MicrosoftJwtPayload);
          },
        );
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Verification failed';
      this.logger.error('Microsoft token verification failed:', errorMessage);
      throw new UnauthorizedException('Invalid Microsoft token');
    }

    // 2. Extract user info
    const { oid, name: _name, email, preferred_username } = payload;
    const userEmail = email || preferred_username;

    if (!oid) {
      throw new UnauthorizedException('Microsoft token missing OID');
    }

    // 3. Check if user exists
    // Lookup by email
    if (!userEmail) {
      throw new UnauthorizedException('Microsoft token missing email');
    }

    const user = await this.usersService.findOneByEmail(userEmail);

    if (!user) {
      // User does not exist, return signup token (consistent with Google)
      const signupPayload = {
        email: userEmail,
        microsoftId: oid, // Keep this in token payload to be used in signup if we decide to use it later, though user requested email only
        type: 'microsoft_signup_init',
      };

      const signupToken = await this.jwtService.signAsync(signupPayload, {
        expiresIn: '10m',
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      return {
        requiresInvite: true,
        email: userEmail,
        signupToken,
      };
    }

    // 4. Generate Session
    const tokens = await this.generateTokens(user);
    await this.updateRefreshToken(user.id, tokens.refresh_token);

    if (user.avatar) {
      const signedUrl = await this.usersService.getSignedUrl(user.avatar);
      if (signedUrl) {
        user.avatar = signedUrl;
      }
    }

    return { user, tokens };
  }

  async microsoftSignup(
    invitationCode: string,
    signupToken: string,
  ): Promise<AuthResult> {
    // Validate invitation code first
    const isValid = await this.invitationService.validateCode(invitationCode);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired invitation code');
    }

    // Verify signup token
    let payload: SignupPayload;
    try {
      payload = await this.jwtService.verifyAsync<SignupPayload>(signupToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch (_e) {
      throw new UnauthorizedException('Invalid or expired signup token');
    }

    if (payload.type !== 'microsoft_signup_init' || !payload.email) {
      throw new UnauthorizedException('Invalid signup token payload');
    }

    const { email } = payload;

    // Double check if user exists
    let user = await this.usersService.findOneByEmail(email);
    if (user) {
      const tokens = await this.generateTokens(user);
      await this.updateRefreshToken(user.id, tokens.refresh_token);
      return { user, tokens };
    }

    // Create new user
    const username = this.generateRandomUsername(email);
    user = await this.usersService.create({
      username,
      email,
    });

    // Mark code as used
    const consumed = await this.invitationService.consumeCode(
      invitationCode,
      user,
    );
    if (!consumed) {
      await this.usersService.delete(user.id);
      throw new UnauthorizedException('Invitation code is no longer valid');
    }

    const tokens = await this.generateTokens(user);
    await this.updateRefreshToken(user.id, tokens.refresh_token);

    return { user, tokens };
  }

  async googleSignup(
    invitationCode: string,
    signupToken: string,
  ): Promise<AuthResult> {
    console.log(
      `[GoogleSignup] Attempting signup with code: ${invitationCode}`,
    );

    // Validate invitation code first
    const isValid = await this.invitationService.validateCode(invitationCode);
    if (!isValid) {
      console.error(
        `[GoogleSignup] Invalid invitation code: ${invitationCode}`,
      );
      throw new UnauthorizedException('Invalid or expired invitation code');
    }

    // Verify our own signup token
    let payload: SignupPayload;
    try {
      payload = await this.jwtService.verifyAsync<SignupPayload>(signupToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : 'Verification failed';
      this.logger.error(`[GoogleSignup] Token verification failed:`, errorMessage);
      throw new UnauthorizedException('Invalid or expired signup token');
    }

    if (payload.type !== 'google_signup_init' || !payload.email) {
      console.error(
        `[GoogleSignup] Invalid payload type or email missing`,
        payload,
      );
      throw new UnauthorizedException('Invalid signup token payload');
    }

    const { email, picture } = payload;
    this.logger.log(`[GoogleSignup] Token verified for email: ${email}`);

    // Double check if user exists
    let user = await this.usersService.findOneByEmail(email);
    if (user) {
      this.logger.log(`[GoogleSignup] User already exists, logging in: ${user.id}`);
      const tokens = await this.generateTokens(user);
      await this.updateRefreshToken(user.id, tokens.refresh_token);

      if (user.avatar) {
        const signedUrl = await this.usersService.getSignedUrl(user.avatar);
        if (signedUrl) {
          user.avatar = signedUrl;
        }
      }
      return { user, tokens };
    }

    // Create new user
    const username = this.generateRandomUsername(email);
    let avatarUrl: string | null = null;
    if (picture) {
      avatarUrl = await this.uploadAvatarToGCS(picture, username);
    }

    user = await this.usersService.create({
      username,
      email,
      avatar: avatarUrl || undefined,
    });

    // Mark code as used (Atomic check)
    const consumed = await this.invitationService.consumeCode(
      invitationCode,
      user,
    );
    if (!consumed) {
      // Rollback user creation if code consumption failed (Race Condition)
      await this.usersService.delete(user.id); // Assuming hard delete or soft delete handling
      console.error(
        `[GoogleSignup] Race Condition: Code ${invitationCode} failed to consume for user ${user.id}`,
      );
      throw new UnauthorizedException('Invitation code is no longer valid');
    }

    const tokens = await this.generateTokens(user);
    await this.updateRefreshToken(user.id, tokens.refresh_token);

    if (user.avatar) {
      const signedUrl = await this.usersService.getSignedUrl(user.avatar);
      if (signedUrl) {
        user.avatar = signedUrl;
      }
    }

    return { user, tokens };
  }

  async validateUser(
    username: string,
    pass: string,
  ): Promise<Partial<User> | null> {
    const user = await this.usersService.findOne(username);
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      const { password: _password, ...result } = user;
      return result;
    }
    return null;
  }

  async register(
    username: string,
    pass: string,
    invitationCode: string,
    email?: string,
  ): Promise<Partial<User>> {
    // Validate invitation code
    const isValid = await this.invitationService.validateCode(invitationCode);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired invitation code');
    }

    const hashedPassword = await bcrypt.hash(pass, 10);
    const user = await this.usersService.create({
      username,
      password: hashedPassword,
      email,
    });

    // Mark code as used (Atomic check)
    const consumed = await this.invitationService.consumeCode(
      invitationCode,
      user,
    );
    if (!consumed) {
      // Rollback user creation
      await this.usersService.delete(user.id);
      throw new UnauthorizedException('Invitation code is no longer valid');
    }

    const { password: _password, ...result } = user;
    return result;
  }

  async logout(userId: string) {
    await this.usersService.update(userId, { hashedRefreshToken: null });
  }

  private async uploadAvatarToGCS(
    url: string,
    username: string,
  ): Promise<string | null> {
    try {
      const bucketName = this.configService.get<string>('GCS_BUCKET_NAME');
      if (!bucketName) return null;

      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const bufferData = Buffer.from(buffer);

      const gsaKeyFile = this.configService.get<string>('GSA_KEY_FILE');

      const storageOptions: StorageOptions = {};
      if (gsaKeyFile) {
        storageOptions.keyFilename = gsaKeyFile;
      }

      const storage = new Storage(storageOptions);
      const bucket = storage.bucket(bucketName);
      const filename = `avatars/${username}_${Date.now()}.jpg`;
      const file = bucket.file(filename);

      await file.save(bufferData, {
        resumable: false,
        validation: false,
        contentType: 'image/jpeg',
      });

      return filename;
    } catch (error) {
      this.logger.error('Failed to upload avatar to GCS:', error);
      return null;
    }
  }
}
