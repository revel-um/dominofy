// src/slack/slack.module.ts
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
  forwardRef,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { VaultModule } from 'src/vault/vault.module';
import { UserModule } from 'src/user/user.module';
import { WorkflowModule } from 'src/workflow/workflow.module';
import { RunnerLauncherModule } from 'src/runner-launcher/runner-launcher.module';

@Module({
  imports: [
    ConfigModule,
    VaultModule,
    UserModule,
    forwardRef(() => WorkflowModule),
    forwardRef(() => RunnerLauncherModule)
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
        { path: 'slack/commands', method: RequestMethod.POST, version: '1' },
      )
      .forRoutes(SlackController);
  }
}
