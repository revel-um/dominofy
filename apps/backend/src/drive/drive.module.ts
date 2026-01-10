import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DriveController } from './drive.controller';
import { DriveService } from './drive.service';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { VaultModule } from 'src/vault/vault.module';
import { UserModule } from 'src/user/user.module';
import { GcsModule } from 'src/gcs/gcs.module';

@Module({
  imports: [ConfigModule, VaultModule, UserModule, GcsModule],
  controllers: [DriveController],
  providers: [DriveService],
  exports: [DriveService],
})
export class DriveModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VerifyTokenMiddleware)
      .exclude(
        { path: 'drive/google/callback', method: RequestMethod.GET, version: '1' },
      )
      .forRoutes(DriveController);
  }
}
