import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from 'src/auth/auth.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [ConfigModule, UserModule],
  controllers: [AuthController],
  providers: [],
  exports: [],
})
export class AuthModule {}
