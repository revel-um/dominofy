import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { generateAccessToken, verifyJwtToken } from 'src/helper/generate.token';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenService } from './refresh-token.service';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly users: UserService,
    private readonly config: ConfigService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(@Body() body: { email?: string; name?: string; provider?: string }) {
    const email = body?.email?.trim();
    if (!email) throw new BadRequestException('email required');

    let user = await this.users.findOneByEmail(email);
    if (!user) {
      user = await this.users.createOAuthUser({
        name: body.name || email.split('@')[0],
        email,
      } as any);
    }

    const accessToken = generateAccessToken(
      { id: (user as any).id, email: (user as any).email },
      this.config.get<string>('JWT_SECRET')!,
      this.config.get<string>('ACCESS_TOKEN_TTL'),
    );

    // Generate refresh token
    const refreshToken = await this.refreshTokenService.generateRefreshToken((user as any).id);

    return { 
      accessToken,
      refreshToken: refreshToken.token
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }) {
    const { refreshToken: tokenString } = body;
    
    if (!tokenString) {
      throw new BadRequestException('Refresh token is required');
    }

    // Find the refresh token in database
    const refreshToken = await this.refreshTokenService.findByToken(tokenString);
    
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Validate the refresh token
    if (!this.refreshTokenService.isTokenValid(refreshToken)) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(
      { id: refreshToken.user.id, email: refreshToken.user.email },
      this.config.get<string>('JWT_SECRET')!,
      this.config.get<string>('ACCESS_TOKEN_TTL'),
    );

    // Generate new refresh token (token rotation)
    const newRefreshToken = await this.refreshTokenService.generateRefreshToken(refreshToken.user.id);

    // Revoke the old refresh token
    await this.refreshTokenService.revokeToken(tokenString, newRefreshToken.token);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken.token
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: { refreshToken: string }) {
    const { refreshToken } = body;
    
    if (refreshToken) {
      await this.refreshTokenService.revokeToken(refreshToken);
    }

    return { message: 'Logged out successfully' };
  }
}
