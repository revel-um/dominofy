import { Controller, Get, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { OAuthService } from './oauth.service';
import { ConfigService } from '@nestjs/config';

@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`${this.getFrontendUrl()}/auth?error=access_denied`);
    }

    if (!code) {
      return res.redirect(`${this.getFrontendUrl()}/auth?error=missing_code`);
    }

    try {
      const { token, user } = await this.oauthService.handleGoogleCallback(code);
      
      // Redirect to frontend with token
      return res.redirect(`${this.getFrontendUrl()}/auth/callback?token=${token}&provider=google`);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return res.redirect(`${this.getFrontendUrl()}/auth?error=oauth_failed`);
    }
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`${this.getFrontendUrl()}/auth?error=access_denied`);
    }

    if (!code) {
      return res.redirect(`${this.getFrontendUrl()}/auth?error=missing_code`);
    }

    try {
      const { token, user } = await this.oauthService.handleGitHubCallback(code);
      
      // Redirect to frontend with token
      return res.redirect(`${this.getFrontendUrl()}/auth/callback?token=${token}&provider=github`);
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      return res.redirect(`${this.getFrontendUrl()}/auth?error=oauth_failed`);
    }
  }

  @Get('google/url')
  getGoogleAuthUrl() {
    const clientId = this.configService.get('GOOGLE_CLIENT_ID');
    const redirectUri = this.configService.get('GOOGLE_REDIRECT_URI');
    const scope = 'openid email profile';
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  }

  @Get('github/url')
  getGitHubAuthUrl() {
    const clientId = this.configService.get('GITHUB_CLIENT_ID');
    const redirectUri = this.configService.get('GITHUB_REDIRECT_URI');
    const scope = 'user:email';
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
    });

    return {
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    };
  }

  private getFrontendUrl(): string {
    return this.configService.get('FRONTEND_BASE_URL') || 'http://localhost:3000';
  }
}
