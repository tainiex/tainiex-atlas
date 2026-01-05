import { Controller, Request, Post, UseGuards, Get, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtRefreshAuthGuard } from './jwt-refresh-auth.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';

@Controller('auth')
@UseGuards(RateLimitGuard) // Apply global guard for this controller (or globally in AppModule)
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    @RateLimit(5, 60) // Limit: 5 requests per 60 seconds
    async login(@Body() req, @Res({ passthrough: true }) res: Response) {
        const user = await this.authService.validateUser(req.username, req.password);
        if (!user) {
            return { message: 'Invalid credentials' };
        }
        const tokens = await this.authService.login(user);

        const cookieDomain = process.env.COOKIE_DOMAIN;

        res.cookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        return tokens;
    }

    @Post('google')
    async googleLogin(@Body() req: { code: string }, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.googleLogin(req.code);

        if (result.requiresInvite) {
            // Return intermediate response asking for invite code
            return result;
        }

        // If login successful (user existed)
        const { user, tokens } = result;

        const cookieDomain = process.env.COOKIE_DOMAIN;

        res.cookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        return user;
    }

    @Post('google/signup')
    async googleSignup(@Body() req: { invitationCode: string, signupToken: string }, @Res({ passthrough: true }) res: Response) {
        const { user, tokens } = await this.authService.googleSignup(req.invitationCode, req.signupToken);

        const cookieDomain = process.env.COOKIE_DOMAIN;

        res.cookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        return user;
    }

    @UseGuards(JwtRefreshAuthGuard)
    @Post('refresh')
    async refresh(@Request() req, @Res({ passthrough: true }) res: Response) {
        const userId = req.user.sub;
        const refreshToken = req.user.refreshToken;

        const tokens = await this.authService.refreshTokens(userId, refreshToken);

        const cookieDomain = process.env.COOKIE_DOMAIN;

        // 设置新的 cookies
        res.cookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        return { message: 'Tokens refreshed successfully' };
    }

    @Post('signup')
    async signup(@Body() req) {
        return this.authService.register(req.username, req.password, req.invitationCode, req.email);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    getProfile(@Request() req) {
        return req.user;
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(@Request() req, @Res({ passthrough: true }) res: Response) {
        await this.authService.logout(req.user.id);

        const cookieDomain = process.env.COOKIE_DOMAIN;
        const cookieOptions: any = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: cookieDomain,
        };

        res.clearCookie('access_token', cookieOptions);
        res.clearCookie('refresh_token', cookieOptions);

        return { message: 'Logged out successfully' };
    }
}
