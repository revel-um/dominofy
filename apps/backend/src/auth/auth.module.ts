import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from 'src/auth/auth.controller';
import { UserModule } from '../user/user.module';
import { RefreshToken } from './refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [
    ConfigModule, 
    UserModule,
    TypeOrmModule.forFeature([RefreshToken])
  ],
  controllers: [AuthController],
  providers: [RefreshTokenService],
  exports: [RefreshTokenService],
})
export class AuthModule {}
