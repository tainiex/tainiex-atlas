import { Controller, Request, Post, UseGuards, Get, Body, Res, BadRequestException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';


import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtRefreshAuthGuard } from './jwt-refresh-auth.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { LoginDto, GoogleLoginDto, MicrosoftLoginDto, SocialSignupDto, SignupDto, LogoutDto, LogoutResponse } from '@tainiex/shared-atlas';

@Controller('auth')
@UseGuards(RateLimitGuard) // Apply global guard for this controller (or globally in AppModule)
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    @RateLimit(5, 60) // Limit: 5 requests per 60 seconds
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: FastifyReply) {
        const user = await this.authService.validateUser(loginDto.username, loginDto.password);
        if (!user) {
            return { message: 'Invalid credentials' };
        }
        const tokens = await this.authService.login(user);

        const cookieDomain = process.env.COOKIE_DOMAIN;
        // In development, use 60s for access token to test refresh logic
        // 在开发环境中，使用 60 秒以测试刷新逻辑
        const accessTokenMaxAge = process.env.NODE_ENV === 'production' ? 15 * 60 : 60; // Seconds

        res.setCookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: accessTokenMaxAge,
            path: '/'
        });

        res.setCookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
            path: '/'
        });

        return tokens;
    }

    @Post('google')
    async googleLogin(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) res: FastifyReply, @Request() req: any) {

        const headers = req.headers;
        console.log('[AuthController] Google Login Headers:', JSON.stringify(headers));

        const authMode = headers['x-auth-mode'];
        const userAgent = (headers['user-agent'] || '').toLowerCase();

        // Detect mobile if explicit header is present OR if user-agent indicates native app networking
        // React Native often uses okhttp (Android) or CFNetwork (iOS)
        const isNativeAgent = userAgent.includes('okhttp') || userAgent.includes('dalvik') || userAgent.includes('cfnetwork');
        const isMobile = authMode === 'bearer' || isNativeAgent;

        console.log(`[AuthController] Mobile Detection: isMobile=${isMobile}, authMode=${authMode}, isNativeAgent=${isNativeAgent}`);

        const result = await this.authService.googleLogin(dto, isMobile);

        if (result.requiresInvite) {
            // Return intermediate response asking for invite code
            return result;
        }

        // If login successful (user existed)
        const { user, tokens } = result;

        const cookieDomain = process.env.COOKIE_DOMAIN;
        const accessTokenMaxAge = process.env.NODE_ENV === 'production' ? 15 * 60 : 60; // Seconds

        res.setCookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: accessTokenMaxAge,
            path: '/'
        });

        res.setCookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
            path: '/'
        });

        if (isMobile) {
            return { user, tokens };
        }

        return user;
    }

    @Post('microsoft')
    async microsoftLogin(@Body() dto: MicrosoftLoginDto, @Res({ passthrough: true }) res: FastifyReply, @Request() req: any) {


        const result = await this.authService.microsoftLogin(dto.idToken);

        if (result.requiresInvite) {
            return result;
        }

        const { user, tokens } = result;

        const cookieDomain = process.env.COOKIE_DOMAIN;
        const accessTokenMaxAge = process.env.NODE_ENV === 'production' ? 15 * 60 : 60; // Seconds

        res.setCookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: accessTokenMaxAge,
            path: '/'
        });

        res.setCookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
            path: '/'
        });

        const authMode = req.headers['x-auth-mode'];
        if (authMode === 'bearer') {
            return { user, tokens };
        }

        return user;
    }

    @Post('microsoft/signup')
    async microsoftSignup(@Body() dto: SocialSignupDto, @Res({ passthrough: true }) res: FastifyReply, @Request() req: any) {


        const { user, tokens } = await this.authService.microsoftSignup(dto.invitationCode, dto.signupToken);

        const cookieDomain = process.env.COOKIE_DOMAIN;
        const accessTokenMaxAge = process.env.NODE_ENV === 'production' ? 15 * 60 : 60; // Seconds

        res.setCookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: accessTokenMaxAge,
            path: '/'
        });

        res.setCookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/'
        });

        const authMode = req.headers['x-auth-mode'];
        if (authMode === 'bearer') {
            return { user, tokens };
        }

        return user;
    }

    @Post('google/signup')
    async googleSignup(@Body() dto: SocialSignupDto, @Res({ passthrough: true }) res: FastifyReply, @Request() req: any) {


        const { user, tokens } = await this.authService.googleSignup(dto.invitationCode, dto.signupToken);

        const cookieDomain = process.env.COOKIE_DOMAIN;
        const accessTokenMaxAge = process.env.NODE_ENV === 'production' ? 15 * 60 : 60; // Seconds

        res.setCookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: accessTokenMaxAge,
            path: '/'
        });

        res.setCookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
            path: '/'
        });

        const authMode = req.headers['x-auth-mode'];
        if (authMode === 'bearer') {
            return { user, tokens };
        }

        return user;
    }

    @UseGuards(JwtRefreshAuthGuard)
    @Post('refresh')
    async refresh(@Request() req: any, @Res({ passthrough: true }) res: FastifyReply) {

        const userId = req.user.sub;
        const refreshToken = req.user.refreshToken;

        const tokens = await this.authService.refreshTokens(userId, refreshToken);

        const cookieDomain = process.env.COOKIE_DOMAIN;
        const accessTokenMaxAge = process.env.NODE_ENV === 'production' ? 15 * 60 : 60; // Seconds

        // 设置新的 cookies
        res.setCookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: accessTokenMaxAge,
            path: '/'
        });

        res.setCookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
            path: '/'
        });

        const authMode = req.headers['x-auth-mode'];
        if (authMode === 'bearer') {
            return { tokens };
        }

        return { message: 'Tokens refreshed successfully' };
    }

    @Post('signup')
    async signup(@Body() signupDto: SignupDto) {
        return this.authService.register(signupDto.username, signupDto.password, signupDto.invitationCode, signupDto.email);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    getProfile(@Request() req: any) {

        return req.user;
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(
        @Request() req: any,
        @Res({ passthrough: true }) res: FastifyReply,
        @Body() _body: LogoutDto,
    ): Promise<LogoutResponse> {

        await this.authService.logout(req.user.id);

        const cookieDomain = process.env.COOKIE_DOMAIN;
        const accessTokenMaxAge = process.env.NODE_ENV === 'production' ? 15 * 60 : 60; // Seconds

        const cookieOptions: any = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: accessTokenMaxAge,
            path: '/'
        };

        res.clearCookie('access_token', cookieOptions);
        res.clearCookie('refresh_token', cookieOptions);

        return { message: 'Logged out successfully' };
    }
}
