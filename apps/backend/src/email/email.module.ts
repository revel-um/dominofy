import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
  forwardRef,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { VerifyTokenMiddleware } from 'src/middlewares/auth.middleware';
import { VaultModule } from 'src/vault/vault.module';
import { UserModule } from 'src/user/user.module';
import { WorkflowModule } from 'src/workflow/workflow.module';
import { RunnerLauncherModule } from 'src/runner-launcher/runner-launcher.module';
import { WorkflowLoggerModule } from 'src/workflow-logger/workflow-logger.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => VaultModule),
    UserModule,
    forwardRef(() => WorkflowModule),
    forwardRef(() => RunnerLauncherModule),
    WorkflowLoggerModule,
  ],
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(VerifyTokenMiddleware)
      .exclude(
        // allow inbound webhooks without auth
        { path: 'email/inbound', method: RequestMethod.POST, version: '1' },
        { path: 'email/google/callback', method: RequestMethod.GET, version: '1' },
        { path: 'email/notifications/gmail', method: RequestMethod.POST, version: '1' },
      )
      .forRoutes(EmailController);
  }
}
