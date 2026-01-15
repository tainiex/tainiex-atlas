import { IsString, IsEmail, MinLength, IsOptional, MaxLength } from 'class-validator';

export class LoginDto {
    @IsString()
    @MinLength(1)
    username: string;

    @IsString()
    @MinLength(6)
    password: string;
}

export class SignupDto {
    @IsString()
    @MinLength(1)
    username: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsString()
    @MinLength(1)
    invitationCode: string;

    @IsEmail()
    @IsOptional()
    email?: string;
}

export class GoogleLoginDto {
    @IsString()
    @IsOptional()
    code?: string;

    @IsString()
    @IsOptional()
    idToken?: string;
}

export class MicrosoftLoginDto {
    @IsString()
    idToken: string;
}

export class SocialSignupDto {
    @IsString()
    invitationCode: string;

    @IsString()
    signupToken: string;
}

export class RefreshTokenDto {
    // Usually refresh token is in cookie/user object, but if sent via body:
    @IsString()
    @IsOptional()
    refreshToken?: string;
}
