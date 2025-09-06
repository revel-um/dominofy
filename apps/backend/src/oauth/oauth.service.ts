import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { generateJwtToken } from '../helper/generate.token';
import axios from 'axios';

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'github';
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async handleGoogleCallback(code: string): Promise<{ token: string; user: User }> {
    try {
      // Exchange code for access token
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.configService.get('GOOGLE_CLIENT_ID'),
        client_secret: this.configService.get('GOOGLE_CLIENT_SECRET'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.configService.get('GOOGLE_REDIRECT_URI'),
      });

      const { access_token } = tokenResponse.data;

      // Get user info from Google
      const userInfoResponse = await axios.get(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`
      );

      const googleUser = userInfoResponse.data;

      const oauthUser: OAuthUserInfo = {
        id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        provider: 'google',
      };

      return await this.findOrCreateUser(oauthUser);
    } catch (error) {
      throw new BadRequestException('Failed to authenticate with Google');
    }
  }

  async handleGitHubCallback(code: string): Promise<{ token: string; user: User }> {
    try {
      // Exchange code for access token
      const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: this.configService.get('GITHUB_CLIENT_ID'),
        client_secret: this.configService.get('GITHUB_CLIENT_SECRET'),
        code,
      }, {
        headers: {
          'Accept': 'application/json',
        },
      });

      const { access_token } = tokenResponse.data;

      // Get user info from GitHub
      const userInfoResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      });

      const githubUser = userInfoResponse.data;

      const oauthUser: OAuthUserInfo = {
        id: githubUser.id.toString(),
        email: githubUser.email || `${githubUser.login}@github.local`,
        name: githubUser.name || githubUser.login,
        picture: githubUser.avatar_url,
        provider: 'github',
      };

      return await this.findOrCreateUser(oauthUser);
    } catch (error) {
      throw new BadRequestException('Failed to authenticate with GitHub');
    }
  }

  private async findOrCreateUser(oauthUser: OAuthUserInfo): Promise<{ token: string; user: User }> {
    // Try to find existing user by email
    let user = await this.userService.findOneByEmail(oauthUser.email);

    if (!user) {
      // Create new user
      const newUser = await this.userService.create({
        name: oauthUser.name,
        email: oauthUser.email,
        password: '', // OAuth users don't have passwords
        oauthProvider: oauthUser.provider,
        oauthId: oauthUser.id,
        profilePicture: oauthUser.picture,
      });

      user = newUser;
    } else {
      // Update existing user with OAuth info if not already set
      if (!user.oauthProvider) {
        await this.userService.update(user.id, {
          oauthProvider: oauthUser.provider,
          oauthId: oauthUser.id,
          profilePicture: oauthUser.picture,
        });
      }
    }

    // Generate JWT token
    const token = generateJwtToken(
      { id: user.id, email: user.email },
      this.configService.get<string>('JWT_SECRET')!
    );

    return { token, user };
  }
}
