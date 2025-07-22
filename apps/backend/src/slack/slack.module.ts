// src/slack/slack.module.ts
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';
import { Vault } from 'src/vault/vault.entity';
import { User } from 'src/user/user.entity';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vault, User]),
    ConfigModule,
  ],
  controllers: [SlackController],
  providers: [SlackService],
  exports: [SlackService],
})
export class SlackModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VerifyTokenMiddleware)
      .exclude(
        // allow Slack’s OAuth callback without auth
        { path: 'slack', method: RequestMethod.GET, version: '1' },
        // allow Events API without auth
        { path: 'slack/events', method: RequestMethod.POST, version: '1' },
        // allow any slash-command without auth
        { path: 'slack/commands/(.*)', method: RequestMethod.POST, version: '1' },
      )
      .forRoutes(SlackController);
  }
}
