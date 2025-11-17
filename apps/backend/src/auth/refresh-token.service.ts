import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private readonly config: ConfigService,
  ) {}

  async generateRefreshToken(userId: number): Promise<RefreshToken> {
    // Generate a secure random token
    const token = crypto.randomBytes(40).toString('hex');
    
    // Set expiration (e.g., 7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId,
      expiresAt,
      isRevoked: false,
    });

    return this.refreshTokenRepository.save(refreshToken);
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({
      where: { token, isRevoked: false },
      relations: ['user'],
    });
  }

  async revokeToken(token: string, replacedByToken?: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { token },
      {
        isRevoked: true,
        revokedAt: new Date(),
        replacedByToken: replacedByToken || null,
      }
    );
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      {
        isRevoked: true,
        revokedAt: new Date(),
      }
    );
  }

  async cleanupExpiredTokens(): Promise<void> {
    await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  isTokenValid(refreshToken: RefreshToken): boolean {
    return (
      !refreshToken.isRevoked &&
      refreshToken.expiresAt > new Date()
    );
  }
}