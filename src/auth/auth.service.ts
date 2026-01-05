import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { InvitationService } from '../invitation/invitation.service';

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;
    private googleClientId: string;
    private googleClientSecret: string;

    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private invitationService: InvitationService,
    ) {
        this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
        this.googleClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
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
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                expiresIn: '15m',
                secret: this.configService.get<string>('JWT_SECRET'),
            }),
            this.jwtService.signAsync(payload, {
                expiresIn: '7d',
                secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refreshSecretKey',
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

    async login(user: any) {
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

        // 更新数据库中的 hashedRefreshToken (token rotation)
        await this.updateRefreshToken(user.id, tokens.refresh_token);

        return tokens;
    }

    async googleLogin(code: string): Promise<any> {
        // Exchange code for tokens
        const { tokens: googleTokens } = await this.googleClient.getToken(code);
        const idToken = googleTokens.id_token;

        if (!idToken) {
            throw new UnauthorizedException('Google login failed: No ID token returned');
        }

        // Verify the ID token
        const ticket = await this.googleClient.verifyIdToken({
            idToken: idToken,
            audience: this.googleClientId,
        });
        const googlePayload = ticket.getPayload();

        if (!googlePayload) {
            throw new UnauthorizedException('Invalid Google token payload');
        }

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
                type: 'google_signup_init'
            };

            const signupToken = await this.jwtService.signAsync(signupPayload, {
                expiresIn: '10m',
                secret: this.configService.get<string>('JWT_SECRET'),
            });

            return {
                requiresInvite: true,
                email,
                picture,
                signupToken
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

    async googleSignup(invitationCode: string, signupToken: string): Promise<any> {
        console.log(`[GoogleSignup] Attempting signup with code: ${invitationCode}`);

        // Validate invitation code first
        const isValid = await this.invitationService.validateCode(invitationCode);
        if (!isValid) {
            console.error(`[GoogleSignup] Invalid invitation code: ${invitationCode}`);
            throw new UnauthorizedException('Invalid or expired invitation code');
        }

        // Verify our own signup token
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(signupToken, {
                secret: this.configService.get<string>('JWT_SECRET'),
            });
        } catch (e) {
            console.error(`[GoogleSignup] Token verification failed:`, e.message);
            throw new UnauthorizedException('Invalid or expired signup token');
        }

        if (payload.type !== 'google_signup_init' || !payload.email) {
            console.error(`[GoogleSignup] Invalid payload type or email missing`, payload);
            throw new UnauthorizedException('Invalid signup token payload');
        }

        const { email, picture } = payload;
        console.log(`[GoogleSignup] Token verified for email: ${email}`);

        // Double check if user exists
        let user = await this.usersService.findOneByEmail(email);
        if (user) {
            console.log(`[GoogleSignup] User already exists, logging in: ${user.id}`);
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
        const consumed = await this.invitationService.consumeCode(invitationCode, user);
        if (!consumed) {
            // Rollback user creation if code consumption failed (Race Condition)
            await this.usersService.delete(user.id); // Assuming hard delete or soft delete handling
            console.error(`[GoogleSignup] Race Condition: Code ${invitationCode} failed to consume for user ${user.id}`);
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

    async validateUser(username: string, pass: string): Promise<any> {
        const user = await this.usersService.findOne(username);
        if (user && user.password && (await bcrypt.compare(pass, user.password))) {
            const { password, ...result } = user;
            return result;
        }
        return null;
    }

    async register(username: string, pass: string, invitationCode: string, email?: string): Promise<any> {
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
        const consumed = await this.invitationService.consumeCode(invitationCode, user);
        if (!consumed) {
            // Rollback user creation
            await this.usersService.delete(user.id);
            throw new UnauthorizedException('Invitation code is no longer valid');
        }

        const { password, ...result } = user;
        return result;
    }

    async logout(userId: string) {
        await this.usersService.update(userId, { hashedRefreshToken: null as any });
    }

    private async uploadAvatarToGCS(url: string, username: string): Promise<string | null> {
        try {
            const bucketName = this.configService.get<string>('GCS_BUCKET_NAME');
            if (!bucketName) return null;

            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            const bufferData = Buffer.from(buffer);

            const gsaKeyFile = this.configService.get<string>('GSA_KEY_FILE');
            const storageOptions: any = {};
            if (gsaKeyFile) {
                storageOptions.keyFilename = gsaKeyFile;
            }

            const storage = new Storage(storageOptions);
            const bucket = storage.bucket(bucketName);
            const filename = `avatars/${username}_${Date.now()}.jpg`;
            const file = bucket.file(filename);

            await file.save(bufferData, {
                contentType: 'image/jpeg',
            });

            return filename;
        } catch (error) {
            console.error('Failed to upload avatar to GCS:', error);
            return null;
        }
    }
}
