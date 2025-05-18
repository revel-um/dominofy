// src/middleware/verifyToken.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class VerifyTokenMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Token not provided');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      const decoded = jwt.verify(token, secret!);
      console.log('Decoded token:', decoded);
      (req as any).user = decoded;
      next();
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
