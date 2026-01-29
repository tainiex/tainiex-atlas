import {
    Controller,
    Request,
    Post,
    UseGuards,
    Get,
    Body,
    Res,
    UnauthorizedException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtRefreshAuthGuard } from './jwt-refresh-auth.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import {
    LoginDto,
    GoogleLoginDto,
    MicrosoftLoginDto,
    SocialSignupDto,
    SignupDto,
    LogoutResponse,
} from '@tainiex/shared-atlas';

import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import type { AuthenticatedRefreshRequest } from './interfaces/authenticated-refresh-request.interface';
import { ConfigurationService } from '../common/config/configuration.service';

@Controller('auth')
@UseGuards(RateLimitGuard) // Apply global guard for this controller (or globally in AppModule)
export class AuthController {
    constructor(
        private authService: AuthService,
        private configService: ConfigurationService
    ) {}

    @Post('login')
    @RateLimit(5, 60) // Limit: 5 requests per 60 seconds
    async login(
        @Body() loginDto: LoginDto,
        @Res({ passthrough: true }) res: FastifyReply,
        @Request() req: FastifyRequest
    ) {
        const user = await this.authService.validateUser(loginDto.username, loginDto.password);
        if (!user) {
            return { message: 'Invalid credentials' };
        }
        const tokens = await this.authService.login(user as User);

        // Use unified cookie configuration
        const cookieConfig = this.configService.getCookieConfig();
        res.setCookie('access_token', tokens.access_token, cookieConfig.access);
        res.setCookie('refresh_token', tokens.refresh_token, cookieConfig.refresh);

        const authMode = req.headers['x-auth-mode'];
        if (authMode === 'bearer') {
            return { user, tokens };
        }

        return user;
    }

    @Post('google')
    async googleLogin(
        @Body() dto: GoogleLoginDto,
        @Res({ passthrough: true }) res: FastifyReply,
        @Request() req: FastifyRequest
    ) {
        const headers = req.headers;
        console.log('[AuthController] Google Login Headers:', JSON.stringify(headers));

        const authMode = headers['x-auth-mode'];
        const userAgent = (headers['user-agent'] || '').toLowerCase();

        // Detect mobile if explicit header is present OR if user-agent indicates native app networking
        // React Native often uses okhttp (Android) or CFNetwork (iOS)
        const isNativeAgent =
            userAgent.includes('okhttp') ||
            userAgent.includes('dalvik') ||
            userAgent.includes('cfnetwork');
        const isMobile = authMode === 'bearer' || isNativeAgent;

        console.log(
            `[AuthController] Mobile Detection: isMobile=${isMobile}, authMode=${String(authMode)}, isNativeAgent=${isNativeAgent}`
        );

        const result = await this.authService.googleLogin(dto, isMobile);

        if (result.requiresInvite || !result.tokens || !result.user) {
            return result;
        }

        const { user, tokens } = result;

        const cookieConfig = this.configService.getCookieConfig();
        res.setCookie('access_token', tokens.access_token, cookieConfig.access);
        res.setCookie('refresh_token', tokens.refresh_token, cookieConfig.refresh);

        if (isMobile) {
            return { user, tokens };
        }

        return user;
    }

    @Post('microsoft')
    async microsoftLogin(
        @Body() dto: MicrosoftLoginDto,
        @Res({ passthrough: true }) res: FastifyReply,
        @Request() req: FastifyRequest
    ) {
        const result = await this.authService.microsoftLogin(dto.idToken);

        if (result.requiresInvite || !result.tokens || !result.user) {
            return result;
        }

        const { user, tokens } = result;

        const cookieConfig = this.configService.getCookieConfig();
        res.setCookie('access_token', tokens.access_token, cookieConfig.access);
        res.setCookie('refresh_token', tokens.refresh_token, cookieConfig.refresh);

        const authMode = req.headers['x-auth-mode'];
        if (authMode === 'bearer') {
            return { user, tokens };
        }

        return user;
    }

    @Post('microsoft/signup')
    async microsoftSignup(
        @Body() dto: SocialSignupDto,
        @Res({ passthrough: true }) res: FastifyReply,
        @Request() req: FastifyRequest
    ) {
        const result = await this.authService.microsoftSignup(dto.invitationCode, dto.signupToken);

        if (!result.tokens || !result.user) {
            throw new UnauthorizedException('Signup failed: No tokens returned');
        }

        const { user, tokens } = result;

        const cookieConfig = this.configService.getCookieConfig();
        res.setCookie('access_token', tokens.access_token, cookieConfig.access);
        res.setCookie('refresh_token', tokens.refresh_token, cookieConfig.refresh);

        const authMode = req.headers['x-auth-mode'];
        if (authMode === 'bearer') {
            return { user, tokens };
        }

        return user;
    }

    @Post('google/signup')
    async googleSignup(
        @Body() dto: SocialSignupDto,
        @Res({ passthrough: true }) res: FastifyReply,
        @Request() req: FastifyRequest
    ) {
        const result = await this.authService.googleSignup(dto.invitationCode, dto.signupToken);

        if (!result.tokens || !result.user) {
            throw new UnauthorizedException('Signup failed: No tokens returned');
        }

        const { user, tokens } = result;

        const cookieConfig = this.configService.getCookieConfig();
        res.setCookie('access_token', tokens.access_token, cookieConfig.access);
        res.setCookie('refresh_token', tokens.refresh_token, cookieConfig.refresh);

        const authMode = req.headers['x-auth-mode'];
        if (authMode === 'bearer') {
            return { user, tokens };
        }

        return user;
    }

    @UseGuards(JwtRefreshAuthGuard)
    @Post('refresh')
    async refresh(
        @Request() req: AuthenticatedRefreshRequest,
        @Res({ passthrough: true }) res: FastifyReply
    ) {
        const userId = req.user.sub;
        const refreshToken = req.user.refreshToken;

        const tokens = await this.authService.refreshTokens(userId, refreshToken);

        // Add null check for tokens
        if (!tokens) {
            throw new Error('Failed to refresh tokens.');
        }

        const cookieConfig = this.configService.getCookieConfig();
        res.setCookie('access_token', tokens.access_token, cookieConfig.access);
        res.setCookie('refresh_token', tokens.refresh_token, cookieConfig.refresh);

        const authMode = req.headers['x-auth-mode'];
        if (authMode === 'bearer') {
            return { tokens };
        }

        return { message: 'Tokens refreshed successfully' };
    }

    @Post('signup')
    async signup(@Body() signupDto: SignupDto) {
        return this.authService.register(
            signupDto.username,
            signupDto.password,
            signupDto.invitationCode,
            signupDto.email
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    getProfile(@Request() req: AuthenticatedRequest) {
        return req.user;
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(
        @Request() req: AuthenticatedRequest,
        @Res({ passthrough: true }) res: FastifyReply
    ): Promise<LogoutResponse> {
        await this.authService.logout(req.user.id);

        const cookieConfig = this.configService.getCookieConfig();
        res.clearCookie('access_token', cookieConfig.access);
        res.clearCookie('refresh_token', cookieConfig.refresh);

        return { message: 'Logged out successfully' };
    }
}
